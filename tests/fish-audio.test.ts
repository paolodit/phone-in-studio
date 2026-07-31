import { describe, expect, it } from "vitest";
import { buildFishTtsRequest, fishSpeechSpeed, resolveFishAudioLatency, resolveFishAudioModel } from "@/lib/fish-audio";

describe("Fish Audio route configuration", () => {
  it("uses the free S2.1 developer model and balanced latency by default", () => {
    expect(resolveFishAudioModel("unknown")).toBe("s2.1-pro-free");
    expect(resolveFishAudioLatency("unknown")).toBe("balanced");
  });

  it("builds a low-latency single-speaker request without exposing credentials", () => {
    const request = buildFishTtsRequest({
      text: "I rang because my cat has started answering back.",
      voiceReferenceId: "voice-model-id",
      pacing: "Brisk",
      model: "s2.1-pro",
      latency: "low",
    });
    expect(request.model).toBe("s2.1-pro");
    expect(request.body).toMatchObject({
      text: "I rang because my cat has started answering back.",
      reference_id: "voice-model-id",
      format: "mp3",
      latency: "low",
      chunk_length: 100,
      prosody: { speed: 1.1 },
    });
    expect(request.body).not.toHaveProperty("apiKey");
  });

  it("maps caller pacing to a restrained Fish prosody range", () => {
    expect(fishSpeechSpeed("Measured")).toBe(0.9);
    expect(fishSpeechSpeed("Conversational")).toBe(1);
    expect(fishSpeechSpeed("Animated")).toBe(1.1);
  });
});
