import { ActivityHandling, EndSensitivity, StartSensitivity } from "@google/genai";
import { describe, expect, it } from "vitest";
import { buildGeminiRealtimeInputConfig, GEMINI_LIVE_MAX_OUTPUT_TOKENS } from "@/lib/gemini-live";

describe("Gemini Live turn handling", () => {
  it("does not let incidental microphone activity interrupt caller audio", () => {
    const config = buildGeminiRealtimeInputConfig();

    expect(config.activityHandling).toBe(ActivityHandling.NO_INTERRUPTION);
    expect(config.automaticActivityDetection).toMatchObject({
      disabled: false,
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 650,
      silenceDurationMs: 800,
    });
  });

  it("allows a complete spoken answer before the output safety ceiling", () => {
    expect(GEMINI_LIVE_MAX_OUTPUT_TOKENS).toBe(1_024);
  });
});
