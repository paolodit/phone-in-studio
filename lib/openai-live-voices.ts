import { normalizeVoicePresentation, OPENAI_VOICE_OPTIONS, resolveOpenAIVoice } from "@/lib/voices";

// Official Live voice catalogue, checked 2026-09-14. Regional influence is not
// a promise of accent fidelity. Keep these separate from Realtime's catalogue.
export const OPENAI_LIVE_VOICE_OPTIONS = [
  ...OPENAI_VOICE_OPTIONS.map((voice) => ({ ...voice, region: "", description: voice.description as string })),
  { id: "quartz", label: "Quartz", presentation: "feminine", region: "Australian", description: "English · Australian influence" },
  { id: "ripple", label: "Ripple", presentation: "masculine", region: "Australian", description: "English · Australian influence" },
  { id: "vesper", label: "Vesper", presentation: "masculine", region: "British", description: "English · British influence" },
  { id: "willow", label: "Willow", presentation: "feminine", region: "Irish", description: "English · Irish influence" },
  { id: "stone", label: "Stone", presentation: "masculine", region: "Irish", description: "English · Irish influence" },
  { id: "gleam", label: "Gleam", presentation: "feminine", region: "North American", description: "English · North American influence" },
  { id: "meridian", label: "Meridian", presentation: "masculine", region: "North American", description: "English · North American influence" },
  { id: "bossa", label: "Bossa", presentation: "feminine", region: "Brazilian", description: "Portuguese · Brazilian influence" },
  { id: "tempo", label: "Tempo", presentation: "masculine", region: "Brazilian", description: "Portuguese · Brazilian influence" },
  { id: "beacon", label: "Beacon", presentation: "masculine", region: "Filipino", description: "English · Filipino influence" },
  { id: "delta", label: "Delta", presentation: "feminine", region: "Southern U.S.", description: "English · Southern U.S. influence" },
  { id: "cinder", label: "Cinder", presentation: "masculine", region: "Southern U.S.", description: "English · Southern U.S. influence" },
] as const;

export function isOpenAILiveVoice(value: unknown): value is string {
  return typeof value === "string" && OPENAI_LIVE_VOICE_OPTIONS.some((voice) => voice.id === value);
}

export function resolveOpenAILiveVoice(performance: Record<string, unknown>, previewVoice?: string) {
  const requested = previewVoice || performance.openaiLiveVoiceId;
  const voice = OPENAI_LIVE_VOICE_OPTIONS.find((item) => item.id === requested);
  const presentation = normalizeVoicePresentation(performance.voicePresentation);
  // A temporary audition is an explicit casting choice; a stored caller still
  // honours their presentation setting when it changes later in the editor.
  if (voice && (previewVoice || presentation === "any" || voice.presentation === presentation)) return voice.id;
  return resolveOpenAIVoice(performance.voiceId, presentation);
}
