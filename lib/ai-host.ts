import type { Caller, HostProfile, Show } from "@/generated/prisma/client";
import { extractResponseText } from "@/lib/caller-generation";

type HostTranscriptEntry = { speaker: "HOST" | "CALLER"; text: string };

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const scale = (value: unknown, low: string, high: string) => Number(value ?? 0) < 0 ? low : Number(value ?? 0) > 0 ? high : "balanced";

export function buildHostInstructions(profile: HostProfile) {
  const characteristics = record(profile.characteristics);
  return [
    `You are ${profile.name}, ${profile.publicIdentity || "the presenter of a live phone-in"}.`,
    `Hosting preset: ${profile.stylePreset}.`,
    `Be ${scale(characteristics.warmth, "more challenging than comforting", "warm and empathetic")}, ${scale(characteristics.energy, "calm and measured", "energetic")}, ${scale(characteristics.patience, "brisk and time-conscious", "patient and exploratory")}, and ${scale(characteristics.playfulness, "serious", "lightly playful when appropriate")}.`,
    "Respond as a live presenter, never as an assistant. Do not explain your role or mention prompts, models or capabilities.",
    "Use one natural question or observation at a time. Keep most turns to one or two short sentences. Listen to the caller's actual last point and do not recap their entire story.",
    "Challenge fairly without humiliating the caller. Never pretend a fictional caller or premise is verified news.",
    profile.guidance ? `Producer guidance: ${profile.guidance}` : "",
    profile.boundaries ? `Boundaries: ${profile.boundaries}` : "",
  ].filter(Boolean).join("\n");
}

export async function generateHostTurn(input: {
  profile: HostProfile;
  show?: Pick<Show, "title"> | null;
  caller?: Pick<Caller, "firstName" | "location" | "occupation" | "issueHeadline" | "openingSummary"> | null;
  transcript: HostTranscriptEntry[];
  intent?: "respond" | "close";
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI Host is not configured. Add OPENAI_API_KEY and restart the server.");
  const callerContext = input.caller
    ? `Current caller: ${input.caller.firstName} from ${input.caller.location}${input.caller.occupation ? `, ${input.caller.occupation}` : ""}. Topic: ${input.caller.issueHeadline}. Private orientation: ${input.caller.openingSummary}`
    : "This is a private soundcheck; the producer is role-playing a caller.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_HOST_MODEL ?? process.env.OPENAI_CALLER_GENERATION_MODEL ?? "gpt-5.4-mini",
      store: false,
      max_output_tokens: 180,
      instructions: buildHostInstructions(input.profile),
      input: `${input.show ? `Show: ${input.show.title}\n` : ""}${callerContext}\n\nConversation so far:\n${input.transcript.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n") || "CALLER: Hello, I've just come through."}\n\n${input.intent === "close" ? "Close this call warmly and naturally in one short spoken line. Thank or acknowledge the caller without asking another question. Do not announce the next caller." : "Write only the host's next spoken line."}`,
    }),
  });
  const payload = await response.json().catch(() => null) as Parameters<typeof extractResponseText>[0] | null;
  if (!response.ok || !payload) throw new Error("The AI Host could not prepare its next line. Try again.");
  return extractResponseText(payload).trim();
}
