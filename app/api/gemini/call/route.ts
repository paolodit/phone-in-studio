import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type LiveConnectConfig,
} from "@google/genai";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { buildGeminiRealtimeInputConfig } from "@/lib/gemini-live";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { realtimeSessionRequestSchema } from "@/lib/schemas";
import { readShowFormatConfig } from "@/lib/show-format";
import { resolveOpenAIVoice } from "@/lib/voices";

export const runtime = "nodejs";

const geminiVoices: Record<string, string> = {
  alloy: "Puck",
  ash: "Charon",
  ballad: "Fenrir",
  coral: "Aoede",
  echo: "Charon",
  sage: "Kore",
  shimmer: "Aoede",
  verse: "Puck",
  marin: "Kore",
  cedar: "Fenrir",
};

function callerVoice(performance: unknown) {
  if (!performance || typeof performance !== "object" || Array.isArray(performance)) return process.env.GEMINI_LIVE_VOICE ?? "Kore";
  const values = performance as Record<string, unknown>;
  const voiceId = resolveOpenAIVoice(values.voiceId, values.voicePresentation);
  return process.env.GEMINI_LIVE_VOICE ?? geminiVoices[voiceId] ?? "Kore";
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = realtimeSessionRequestSchema.parse(await request.json());
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini Live is not configured. Add GEMINI_API_KEY to .env.local, then restart the local server." }, { status: 503 });

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

  const model = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
  const instructions = buildRealtimeSessionConfig(caller, format).instructions;
  const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: instructions,
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: callerVoice(caller.performance) } } },
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: buildGeminiRealtimeInputConfig(),
    maxOutputTokens: 180,
  };

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: { model, config },
        lockAdditionalFields: [],
      },
    });
    if (!token.name) throw new Error("Gemini did not return a session token.");
    return NextResponse.json({ token: token.name, model, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini Live could not create a caller session.";
    return NextResponse.json({ error: `Gemini Live could not start the caller: ${message}` }, { status: 502 });
  }
}
