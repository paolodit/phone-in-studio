import {
  ActivityHandling,
  EndSensitivity,
  StartSensitivity,
  type RealtimeInputConfig,
} from "@google/genai";

export function buildGeminiRealtimeInputConfig(): RealtimeInputConfig {
  return {
    automaticActivityDetection: {
      disabled: false,
      // Require sustained, speech-like input and tolerate a natural pause in
      // the host's sentence before committing the turn.
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 400,
      silenceDurationMs: 650,
    },
    // Incidental room noise must not cut off a caller. A producer can still
    // barge in deliberately through sendClientContent via the Interrupt control.
    activityHandling: ActivityHandling.NO_INTERRUPTION,
  };
}
