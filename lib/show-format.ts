export const SHOW_FORMATS = [
  { id: "general", label: "General call-in", guidance: "A flexible host-led call-in where callers bring a clear issue, point of view, story or question." },
  { id: "advice", label: "Advice and dilemmas", guidance: "Callers bring a real-feeling dilemma and want perspective, reassurance or a practical next step." },
  { id: "discussion", label: "Discussion and opinion", guidance: "Callers contribute a specific, considered point of view and engage constructively with challenge." },
  { id: "stories", label: "Late-night stories", guidance: "Callers tell a concise, personal-feeling story with a strong opening and a satisfying detail or turn." },
  { id: "sports", label: "Sports fan line", guidance: "Callers are passionate but informed supporters with a clear sporting claim, memory or debate point." },
  { id: "competition", label: "Games and competition", guidance: "Callers are upbeat contestants. Keep turns short, responsive and easy for a host to guide." },
  { id: "entertainment", label: "Comedy and entertainment", guidance: "Callers can be heightened and playful, but the humour comes from the situation and a human blind spot, never cruelty." },
] as const;

export type ShowFormatId = typeof SHOW_FORMATS[number]["id"];
export type VoiceProviderId = "openai" | "elevenlabs";

export type ShowFormatConfig = {
  programmeName: string;
  formatId: ShowFormatId;
  formatLabel: string;
  formatGuidance: string;
  voiceProvider: VoiceProviderId;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function formatFor(id: unknown) {
  return SHOW_FORMATS.find((format) => format.id === id) ?? SHOW_FORMATS[0];
}

export function readShowFormatConfig(brandingConfig: unknown, fallbackTitle: string): ShowFormatConfig {
  const config = isRecord(brandingConfig) ? brandingConfig : {};
  const format = formatFor(config.formatId);
  return {
    programmeName: typeof config.programmeName === "string" && config.programmeName.trim() ? config.programmeName : fallbackTitle,
    formatId: format.id,
    formatLabel: format.label,
    formatGuidance: typeof config.formatGuidance === "string" && config.formatGuidance.trim() ? config.formatGuidance : format.guidance,
    voiceProvider: config.voiceProvider === "elevenlabs" ? "elevenlabs" : "openai",
  };
}

export function buildShowFormatConfig(input: { title: string; formatId?: string; formatGuidance?: string; voiceProvider?: string }, existing?: unknown): ShowFormatConfig {
  const current = readShowFormatConfig(existing, input.title);
  const format = formatFor(input.formatId ?? current.formatId);
  return {
    programmeName: input.title,
    formatId: format.id,
    formatLabel: format.label,
    formatGuidance: input.formatGuidance?.trim() || current.formatGuidance || format.guidance,
    voiceProvider: input.voiceProvider === "elevenlabs" ? "elevenlabs" : "openai",
  };
}
