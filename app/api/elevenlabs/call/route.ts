import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { realtimeSessionRequestSchema } from "@/lib/schemas";
import { readShowFormatConfig } from "@/lib/show-format";

export const runtime = "nodejs";

const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = realtimeSessionRequestSchema.parse(await request.json());
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: "ElevenLabs is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to .env.local, then restart the local server." }, { status: 503 });
  }

  const show = await prisma.show.findUniqueOrThrow({
    where: { id: input.showId },
    select: { currentQueueItemId: true, title: true, brandingConfig: true },
  });
  const current = show.currentQueueItemId
    ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, include: { caller: { include: { assets: true } } } })
    : null;
  if (!current || current.callerId !== input.callerId) return NextResponse.json({ error: "The requested caller is not the active show caller." }, { status: 409 });

  const tokenUrl = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  tokenUrl.searchParams.set("agent_id", agentId);
  tokenUrl.searchParams.set("participant_name", `caller-${current.callerId}`);
  const response = await fetch(tokenUrl, { headers: { "xi-api-key": apiKey } });
  const body = await response.json().catch(() => null) as { token?: string; detail?: { message?: string }; message?: string } | null;
  if (!response.ok || !body?.token) {
    const detail = body?.detail?.message || body?.message;
    return NextResponse.json({ error: detail ? `ElevenLabs could not create a caller session: ${detail}` : "ElevenLabs could not create a caller session. Check the Agent ID and server API key." }, { status: 502 });
  }

  const performance = asRecord(current.caller.performance);
  const session = buildRealtimeSessionConfig(current.caller, readShowFormatConfig(show.brandingConfig, show.title));
  return NextResponse.json({
    conversationToken: body.token,
    instructions: session.instructions,
    elevenLabsVoiceId: typeof performance.elevenLabsVoiceId === "string" ? performance.elevenLabsVoiceId : undefined,
    dynamicVariables: {
      caller_name: current.caller.firstName,
      caller_location: current.caller.location,
      caller_issue: current.caller.issueHeadline,
      caller_summary: current.caller.openingSummary,
    },
  });
}
