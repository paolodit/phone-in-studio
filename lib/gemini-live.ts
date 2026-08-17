import {
  ActivityHandling,
  EndSensitivity,
  StartSensitivity,
  type RealtimeInputConfig,
} from "@google/genai";

// Native audio consumes roughly 25 tokens per second. The previous 180-token
// ceiling could terminate an otherwise normal seven-second answer mid-sentence.
// Keep a generous runaway guard and let the caller prompt control normal length.
export const GEMINI_LIVE_MAX_OUTPUT_TOKENS = 1_024;

export function buildGeminiRealtimeInputConfig(): RealtimeInputConfig {
  return {
    automaticActivityDetection: {
      disabled: false,
      // Require sustained, speech-like input and tolerate a natural pause in
      // the host's sentence before committing the turn.
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 650,
      silenceDurationMs: 800,
    },
    // Incidental room noise must not cut off a caller. A producer can still
    // barge in deliberately through sendClientContent via the Interrupt control.
    activityHandling: ActivityHandling.NO_INTERRUPTION,
  };
}
