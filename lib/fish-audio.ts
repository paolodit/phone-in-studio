import type { Caller, CallerAsset } from "@/generated/prisma/client";
import { extractResponseText } from "@/lib/caller-generation";
import { prisma } from "@/lib/prisma";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { readShowFormatConfig } from "@/lib/show-format";

export type FishTranscriptEntry = { speaker: "HOST" | "CALLER"; text: string };
export type FishAudioModel = "s1" | "s2-pro" | "s2.1-pro" | "s2.1-pro-free";
export type FishAudioLatency = "low" | "balanced" | "normal";

export class FishSessionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function fishApiKey() {
  return process.env.FISH_API_KEY ?? process.env.FISH_AUDIO_API_KEY;
}

export function resolveFishAudioModel(value = process.env.FISH_AUDIO_MODEL): FishAudioModel {
  return value === "s1" || value === "s2-pro" || value === "s2.1-pro" || value === "s2.1-pro-free"
    ? value
    : "s2.1-pro-free";
}

export function resolveFishAudioLatency(value = process.env.FISH_AUDIO_LATENCY): FishAudioLatency {
  return value === "low" || value === "normal" || value === "balanced" ? value : "balanced";
}

export function fishSpeechSpeed(pacing: unknown) {
  const value = typeof pacing === "string" ? pacing.toLowerCase() : "";
  if (/(measured|thoughtful|slow|deliberate)/.test(value)) return 0.9;
  if (/(brisk|quick|fast|energetic|animated)/.test(value)) return 1.1;
  return 1;
}

export function buildFishTtsRequest(input: {
  text: string;
  voiceReferenceId?: string;
  pacing?: unknown;
  model?: string;
  latency?: string;
}) {
  return {
    model: resolveFishAudioModel(input.model),
    body: {
      text: input.text,
      ...(input.voiceReferenceId ? { reference_id: input.voiceReferenceId } : {}),
      format: "mp3" as const,
      latency: resolveFishAudioLatency(input.latency),
      chunk_length: 100,
      min_chunk_length: 20,
      normalize: true,
      condition_on_previous_chunks: true,
      temperature: 0.75,
      top_p: 0.7,
      prosody: {
        speed: fishSpeechSpeed(input.pacing),
        volume: 0,
        normalize_loudness: true,
      },
    },
  };
}

export async function loadFishCallerContext(input: { showId: string; callerId: string; testMode: boolean }) {
  let caller: Caller & { assets: CallerAsset[] };
  let format: { formatLabel: string; formatGuidance: string };
  if (input.testMode) {
    caller = await prisma.caller.findUniqueOrThrow({ where: { id: input.callerId }, include: { assets: true } });
    format = {
      formatLabel: "Private caller soundcheck",
      formatGuidance: "This is an isolated producer soundcheck. Stay in character, open with a natural call-in first line, and respond conversationally. Nothing here is on air.",
    };
  } else {
    const show = await prisma.show.findUniqueOrThrow({
      where: { id: input.showId },
      select: { currentQueueItemId: true, title: true, brandingConfig: true },
    });
    const current = show.currentQueueItemId
      ? await prisma.queueItem.findUnique({ where: { id: show.currentQueueItemId }, include: { caller: { include: { assets: true } } } })
      : null;
    if (!current || current.callerId !== input.callerId) throw new FishSessionError("The requested caller is not the active show caller.", 409);
    caller = current.caller;
    format = readShowFormatConfig(show.brandingConfig, show.title);
  }
  const performance = record(caller.performance);
  const session = buildRealtimeSessionConfig(caller, format);
  return {
    caller,
    format,
    instructions: session.instructions,
    voiceReferenceId: typeof performance.fishAudioVoiceId === "string" && performance.fishAudioVoiceId.trim()
      ? performance.fishAudioVoiceId.trim()
      : process.env.FISH_AUDIO_VOICE_ID?.trim() || undefined,
    pacing: performance.pacing,
    model: resolveFishAudioModel(),
    latency: resolveFishAudioLatency(),
  };
}

export async function generateFishCallerTurn(input: {
  instructions: string;
  transcript: FishTranscriptEntry[];
  opening?: boolean;
  producerDirection?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new FishSessionError("Fish Audio supplies the voice, but the caller dialogue engine still needs OPENAI_API_KEY.", 503);
  const conversation = input.transcript.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.FISH_DIALOGUE_MODEL ?? process.env.OPENAI_CALLER_GENERATION_MODEL ?? "gpt-5.4-mini",
      store: false,
      max_output_tokens: 180,
      instructions: `${input.instructions}

# Fish Audio turn-taking
This is a deliberate turn-based call rather than a duplex Realtime session. Write only the caller's next spoken words. Never add a speaker label, stage direction, analysis or quotation marks. Keep the reply natural and easy to say aloud.`,
      input: input.opening
        ? `The line has just connected. Give the caller's first natural contribution in one or two short sentences. Start directly with why they rang; do not introduce their role, character brief, abilities or the technology.${input.producerDirection ? `\nProducer direction: ${input.producerDirection}` : ""}`
        : `Conversation so far:\n${conversation || "No completed turns yet."}\n\nRespond to the host's latest point as this caller in one to three short spoken sentences.${input.producerDirection ? `\nProducer direction: ${input.producerDirection}` : ""}`,
    }),
  });
  const payload = await response.json().catch(() => null) as Parameters<typeof extractResponseText>[0] | null;
  if (!response.ok || !payload) throw new FishSessionError("The Fish caller's dialogue engine could not prepare the next line.", 502);
  const text = extractResponseText(payload).trim();
  if (!text) throw new FishSessionError("The Fish caller returned an empty line.", 502);
  return text;
}
