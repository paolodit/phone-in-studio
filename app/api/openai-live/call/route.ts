import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openaiLiveCallRequestSchema } from "@/lib/schemas";
import { readShowFormatConfig } from "@/lib/show-format";
import { buildOpenAILiveSessionConfig } from "@/lib/openai-live-session";
import { createLiveCloseToken, hangupOpenAILiveSession } from "@/lib/openai-live-close";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = openaiLiveCallRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A caller, show and valid SDP offer are required. Voice auditions are private-test only." }, { status: 400 });
  const input = parsed.data;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Add OPENAI_API_KEY and restart the server to use GPT-Live-1." }, { status: 503 });
  const caller = await prisma.caller.findUnique({ where: { id: input.callerId } });
  if (!caller) return NextResponse.json({ error: "Caller not found." }, { status: 404 });
  let format = { formatLabel: "Private soundcheck", formatGuidance: "An isolated test, not a live broadcast. Stay in character." };
  if (!input.testMode) {
    const show = await prisma.show.findUnique({ where: { id: input.showId }, select: { currentQueueItemId: true, title: true, brandingConfig: true } });
    const current = show?.currentQueueItemId ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, select: { callerId: true } }) : null;
    if (!show || current?.callerId !== caller.id) return NextResponse.json({ error: "This is not the active show caller." }, { status: 409 });
    format = readShowFormatConfig(show.brandingConfig, show.title);
  }
  const session = buildOpenAILiveSessionConfig(caller, format, input.previewVoice);
  let createdSessionId: string | undefined;
  try {
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session, transport: { type: "webrtc", sdp: input.sdp } }), signal: AbortSignal.timeout(25_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const hint = result?.error?.code === "invalid_offer"
        ? "The WebRTC connection offer was rejected. Refresh Studio and reconnect; this is not a voice or microphone setting."
        : response.status === 401 || response.status === 403 || response.status === 404
        ? "Check this API project's GPT-Live-1 access and OPENAI_API_KEY. Realtime 1.5 remains available."
        : response.status === 429 ? "The API project has reached a rate or usage limit. Try again later." : "Check the model setting and try again.";
      return NextResponse.json({ error: `GPT-Live could not connect (HTTP ${response.status}). ${hint}` }, { status: 502 });
    }
    createdSessionId = typeof result?.session?.id === "string" ? result.session.id : undefined;
    if (!createdSessionId || typeof result?.transport?.sdp !== "string" || !result.transport.sdp.trim()) {
      if (createdSessionId) await hangupOpenAILiveSession(createdSessionId);
      return NextResponse.json({ error: "GPT-Live returned an invalid session answer." }, { status: 502 });
    }
    if (request.signal.aborted) { await hangupOpenAILiveSession(result.session.id); return new Response(null, { status: 499 }); }
    return NextResponse.json({ sdp: result.transport.sdp, sessionId: result.session.id, closeToken: createLiveCloseToken(result.session.id), voice: session.audio.output.voice, model: session.model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (createdSessionId) await hangupOpenAILiveSession(createdSessionId).catch(() => false);
    return NextResponse.json({ error: "GPT-Live session creation timed out or the network failed. Try again; your show state has not changed." }, { status: 502 });
  }
}
