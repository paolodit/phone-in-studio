import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { realtimeSessionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();
  const input = realtimeSessionRequestSchema.parse(await request.json());
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Realtime is not configured. Set OPENAI_API_KEY to enable a live caller; mock mode remains available." }, { status: 503 });

  const show = await prisma.show.findUniqueOrThrow({ where: { id: input.showId }, select: { currentQueueItemId: true } });
  const current = show.currentQueueItemId ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, include: { caller: { include: { assets: true } } } }) : null;
  if (!current || current.callerId !== input.callerId) return NextResponse.json({ error: "The requested caller is not the active show caller." }, { status: 409 });

  const session = buildRealtimeSessionConfig(current.caller);
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ session: { type: "realtime", ...session } }),
  });
  const payload = await response.json().catch(() => null) as { value?: string; expires_at?: number; client_secret?: { value?: string; expires_at?: number }; model?: string; error?: { message?: string; code?: string } } | null;
  const clientSecret = payload?.value ?? payload?.client_secret?.value;
  const expiresAt = payload?.expires_at ?? payload?.client_secret?.expires_at;
  if (!response.ok || !clientSecret) {
    await prisma.showEvent.create({ data: { showId: input.showId, type: "VOICE_SESSION_ERROR", payload: { source: "session_setup", status: response.status, code: payload?.error?.code ?? "unknown" } } });
    return NextResponse.json({ error: "Unable to create the Realtime session. Check the server API key and configured model." }, { status: 502 });
  }
  return NextResponse.json({ clientSecret, expiresAt, model: payload?.model ?? session.model });
}
