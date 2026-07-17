import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { realtimeCallRequestSchema } from "@/lib/schemas";
import { readShowFormatConfig } from "@/lib/show-format";

export const runtime = "nodejs";

function safetyIdentifier(callerId: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "development-only")
    .update(`realtime:${callerId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = realtimeCallRequestSchema.parse(await request.json());
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Realtime is not configured. Add OPENAI_API_KEY, then restart the local server." }, { status: 503 });

  let caller = await prisma.caller.findUniqueOrThrow({ where: { id: input.callerId }, include: { assets: true } });
  let format = { formatLabel: "Private caller soundcheck", formatGuidance: "This is an isolated producer soundcheck. Stay in character, open with a natural call-in first line, and respond conversationally. Nothing here is on air." };
  if (!input.testMode) {
    const show = await prisma.show.findUniqueOrThrow({ where: { id: input.showId }, select: { currentQueueItemId: true, title: true, brandingConfig: true } });
    const current = show.currentQueueItemId
      ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, include: { caller: { include: { assets: true } } } })
      : null;
    if (!current || current.callerId !== input.callerId) return NextResponse.json({ error: "The requested caller is not the active show caller." }, { status: 409 });
    caller = current.caller;
    format = readShowFormatConfig(show.brandingConfig, show.title);
  }

  const sessionConfig = buildRealtimeSessionConfig(caller, format);
  const body = new FormData();
  body.set("sdp", input.sdp);
  body.set("session", JSON.stringify({ type: "realtime", ...sessionConfig }));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": safetyIdentifier(caller.id),
    },
    body,
  });
  const answer = await response.text();
  if (!response.ok) {
    let detail = input.testMode ? "OpenAI could not start the private soundcheck. Try again." : "OpenAI could not start the live caller. Try Connect AI caller again.";
    try {
      const error = JSON.parse(answer) as { error?: { message?: string } };
      if (error.error?.message) detail = `OpenAI could not start the caller: ${error.error.message}`;
    } catch { /* Keep the safe fallback instead of returning raw provider output. */ }
    if (!input.testMode) await prisma.showEvent.create({ data: { showId: input.showId, type: "VOICE_SESSION_ERROR", payload: { source: "webrtc_call", status: response.status } } });
    return NextResponse.json({ error: detail }, { status: 502 });
  }
  return NextResponse.json({ sdp: answer, instructions: sessionConfig.instructions });
}
