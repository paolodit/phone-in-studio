import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { realtimeCallRequestSchema } from "@/lib/schemas";

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

  const show = await prisma.show.findUniqueOrThrow({ where: { id: input.showId }, select: { currentQueueItemId: true } });
  const current = show.currentQueueItemId
    ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, include: { caller: { include: { assets: true } } } })
    : null;
  if (!current || current.callerId !== input.callerId) return NextResponse.json({ error: "The requested caller is not the active show caller." }, { status: 409 });

  const body = new FormData();
  body.set("sdp", input.sdp);
  body.set("session", JSON.stringify({ type: "realtime", ...buildRealtimeSessionConfig(current.caller) }));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": safetyIdentifier(current.callerId),
    },
    body,
  });
  const answer = await response.text();
  if (!response.ok) {
    let detail = "OpenAI could not start the live caller. Try Connect AI caller again.";
    try {
      const error = JSON.parse(answer) as { error?: { message?: string } };
      if (error.error?.message) detail = `OpenAI could not start the live caller: ${error.error.message}`;
    } catch { /* The standard fallback is safe and more useful than raw HTML. */ }
    await prisma.showEvent.create({ data: { showId: input.showId, type: "VOICE_SESSION_ERROR", payload: { source: "webrtc_call", status: response.status } } });
    return NextResponse.json({ error: detail }, { status: 502 });
  }
  return NextResponse.json({ sdp: answer });
}
