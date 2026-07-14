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
});
