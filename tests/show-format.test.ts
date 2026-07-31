import { describe, expect, it } from "vitest";
import { buildShowFormatConfig, readShowFormatConfig } from "@/lib/show-format";

describe("show format configuration", () => {
  it("defaults legacy shows to a general OpenAI call-in", () => {
    const config = readShowFormatConfig({ programmeName: "Legacy show" }, "Fallback");
    expect(config.formatId).toBe("general");
    expect(config.voiceProvider).toBe("openai");
  });

  it("keeps an explicit format brief and optional ElevenLabs route", () => {
    const config = buildShowFormatConfig({ title: "Nightline", formatId: "stories", formatGuidance: "Personal stories with a gentle host.", voiceProvider: "elevenlabs" });
    expect(config).toMatchObject({ programmeName: "Nightline", formatId: "stories", voiceProvider: "elevenlabs", formatGuidance: "Personal stories with a gentle host." });
  });

  it("preserves the optional Gemini Live route", () => {
    const config = buildShowFormatConfig({ title: "Open line", formatId: "discussion", voiceProvider: "gemini" });
    expect(config.voiceProvider).toBe("gemini");
    expect(readShowFormatConfig(config, "Fallback").voiceProvider).toBe("gemini");
  });

  it("preserves the optional Fish Audio route", () => {
    const config = buildShowFormatConfig({ title: "Voice lab", formatId: "general", voiceProvider: "fish" });
    expect(config.voiceProvider).toBe("fish");
    expect(readShowFormatConfig(config, "Fallback").voiceProvider).toBe("fish");
  });
});
