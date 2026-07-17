export type VoicePresentation = "any" | "feminine" | "masculine" | "neutral";

export const OPENAI_VOICE_OPTIONS = [
  { id: "alloy", label: "Alloy", description: "neutral", presentation: "neutral" },
  { id: "ash", label: "Ash", description: "lively", presentation: "masculine" },
  { id: "ballad", label: "Ballad", description: "rounded", presentation: "masculine" },
  { id: "coral", label: "Coral", description: "warm", presentation: "feminine" },
  { id: "cedar", label: "Cedar", description: "dry", presentation: "masculine" },
  { id: "echo", label: "Echo", description: "low-key", presentation: "masculine" },
  { id: "marin", label: "Marin", description: "balanced", presentation: "feminine" },
  { id: "sage", label: "Sage", description: "composed", presentation: "feminine" },
  { id: "shimmer", label: "Shimmer", description: "bright", presentation: "feminine" },
  { id: "verse", label: "Verse", description: "expressive", presentation: "masculine" },
] as const;

const legacyVoiceAliases: Record<string, string> = {
  "mock-warm-welsh": "coral",
  "mock-dry-welsh": "cedar",
  "mock-confident-welsh": "shimmer",
  "mock-gravel-welsh": "echo",
  "mock-keen-welsh": "ash",
};

const voicePresentations = new Map<string, VoicePresentation>(OPENAI_VOICE_OPTIONS.map((voice) => [voice.id, voice.presentation]));
const presentationDefaults: Record<Exclude<VoicePresentation, "any">, string> = {
  feminine: "marin",
  masculine: "cedar",
  neutral: "alloy",
};

export function normalizeVoicePresentation(value: unknown): VoicePresentation {
  return value === "feminine" || value === "masculine" || value === "neutral" ? value : "any";
}

export function normalizeOpenAIVoice(value: unknown) {
  if (typeof value !== "string") return "marin";
  const voice = legacyVoiceAliases[value] ?? value;
  return voicePresentations.has(voice) ? voice : "marin";
}

export function resolveOpenAIVoice(voiceId: unknown, presentationValue?: unknown) {
  const voice = normalizeOpenAIVoice(voiceId);
  const presentation = normalizeVoicePresentation(presentationValue);
  if (presentation === "any" || voicePresentations.get(voice) === presentation) return voice;
  return presentationDefaults[presentation];
}

export function voiceMatchesPresentation(voiceId: unknown, presentationValue: unknown) {
  const presentation = normalizeVoicePresentation(presentationValue);
  return presentation === "any" || voicePresentations.get(normalizeOpenAIVoice(voiceId)) === presentation;
}
