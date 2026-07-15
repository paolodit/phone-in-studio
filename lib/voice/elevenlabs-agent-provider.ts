"use client";

import { Conversation, type VoiceConversation } from "@elevenlabs/client";
import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";

function normalized(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function frequencyBands(values: Uint8Array, count = 12) {
  if (!values.length) return Array.from({ length: count }, () => 0);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * values.length));
    let total = 0;
    for (let bucket = start; bucket < end; bucket += 1) total += values[bucket] ?? 0;
    return normalized(total / (end - start) / 180);
  });
}

type ElevenLabsSessionPayload = {
  conversationToken: string;
  instructions: string;
  elevenLabsVoiceId?: string;
  dynamicVariables: Record<string, string>;
};

export class ElevenLabsAgentVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    config.onStatus?.("Getting a short-lived ElevenLabs session…");
    const response = await fetch("/api/elevenlabs/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: config.showId, callerId: config.callerId, testMode: config.testMode ?? false }),
    });
    const payload = await response.json().catch(() => null) as (ElevenLabsSessionPayload & { error?: string }) | null;
    if (!response.ok || !payload?.conversationToken) throw new Error(payload?.error ?? "ElevenLabs could not start the caller session.");

    let outputVolume = 1;
    let muted = false;
    let ended = false;
    let frame = 0;
    let conversation: VoiceConversation;
    const updateOutput = () => conversation.setVolume({ volume: muted ? 0 : outputVolume });

    conversation = await Conversation.startSession({
      conversationToken: payload.conversationToken,
      connectionType: "webrtc",
      inputDeviceId: config.inputDeviceId,
      userId: `${config.testMode ? "caller-test" : "phone-in"}:${config.showId}:${config.callerId}`,
      dynamicVariables: payload.dynamicVariables,
      overrides: {
        agent: { prompt: { prompt: payload.instructions } },
        tts: {
          ...(payload.elevenLabsVoiceId ? { voiceId: payload.elevenLabsVoiceId } : {}),
          stability: 0.45,
          similarityBoost: 0.75,
        },
      },
      onConnect: () => config.onStatus?.("ElevenLabs caller connected"),
      onDisconnect: () => { if (!ended) config.onStatus?.("ElevenLabs caller disconnected"); },
      onError: (message) => config.onError?.(message),
      onMessage: ({ role, message }) => config.onTranscript?.({ speaker: role === "agent" ? "CALLER" : "HOST", text: message }),
      onModeChange: ({ mode }) => config.onStatus?.(mode === "speaking" ? "Caller speaking" : "Host speaking"),
    }) as VoiceConversation;
    updateOutput();

    const measure = () => {
      if (ended) return;
      const inputBands = frequencyBands(conversation.getInputByteFrequencyData());
      const outputBands = frequencyBands(conversation.getOutputByteFrequencyData());
      config.onLevels?.({
        input: normalized(conversation.getInputVolume()),
        output: normalized(conversation.getOutputVolume()),
        inputBands,
        outputBands,
      });
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);

    return {
      async updateInstructions(instructions) { conversation.sendContextualUpdate(`Updated caller direction: ${instructions}`); },
      async interrupt() { conversation.sendUserActivity(); },
      async muteOutput(nextMuted) { muted = nextMuted; updateOutput(); },
      async setOutputVolume(volume) { outputVolume = normalized(volume); updateOutput(); },
      async switchInputDevice(deviceId) { await conversation.changeInputDevice({ inputDeviceId: deviceId, preferHeadphonesForIosDevices: true }); },
      async endSession() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        await conversation.endSession();
      },
    };
  }
}
