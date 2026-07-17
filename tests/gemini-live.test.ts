import { ActivityHandling, EndSensitivity, StartSensitivity } from "@google/genai";
import { describe, expect, it } from "vitest";
import { buildGeminiRealtimeInputConfig } from "@/lib/gemini-live";

describe("Gemini Live turn handling", () => {
  it("does not let incidental microphone activity interrupt caller audio", () => {
    const config = buildGeminiRealtimeInputConfig();

    expect(config.activityHandling).toBe(ActivityHandling.NO_INTERRUPTION);
    expect(config.automaticActivityDetection).toMatchObject({
      disabled: false,
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 400,
      silenceDurationMs: 650,
    });
  });
});
