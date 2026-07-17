"use client";

import { GoogleGenAI, type LiveConnectConfig, type LiveServerMessage, type Session } from "@google/genai";
import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";

type GeminiSessionPayload = { token: string; model: string; config: LiveConnectConfig; error?: string };

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function microphoneIssue() {
  if (!window.isSecureContext) return `Live caller audio is blocked at ${window.location.origin}. Open http://localhost:3000 on this computer, or use HTTPS.`;
  if (!navigator.mediaDevices?.getUserMedia) return "This browser does not expose microphone access. Use Chrome or Edge on desktop and allow microphone permission.";
  return null;
}

async function getMicrophone(deviceId?: string) {
  const issue = microphoneIssue();
  if (issue) throw new Error(issue);
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    } });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error("Microphone permission was blocked. Allow microphone access for this site, then connect the caller again.");
    if (name === "NotFoundError") throw new Error("No microphone was found. Connect or select a microphone, then try again.");
    if (name === "NotReadableError") throw new Error("The microphone is busy in another application. Close the other application and try again.");
    throw error;
  }
}

function level(analyser?: AnalyserNode) {
  if (!analyser) return 0;
  const values = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(values);
  let total = 0;
  for (const value of values) total += Math.abs(value - 128);
  return clamp(total / values.length / 40);
}

function frequencyBands(analyser?: AnalyserNode, count = 12) {
  if (!analyser) return Array.from({ length: count }, () => 0);
  const values = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(values);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * values.length));
    let total = 0;
    for (let bucket = start; bucket < end; bucket += 1) total += values[bucket] ?? 0;
    return clamp(total / (end - start) / 180);
  });
}

function pcmBase64(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function pcmAudioBuffer(context: AudioContext, encoded: string) {
  const binary = atob(encoded);
  const sampleCount = Math.floor(binary.length / 2);
  const buffer = context.createBuffer(1, sampleCount, 24_000);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const signed = (high << 8) | low;
    channel[index] = (signed & 0x8000 ? signed - 0x10000 : signed) / 0x8000;
  }
  return buffer;
}

export class GeminiLiveVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    config.onStatus?.("Requesting microphone permission…");
    let microphone = await getMicrophone(config.inputDeviceId);
    const response = await fetch("/api/gemini/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: config.showId, callerId: config.callerId, testMode: config.testMode ?? false }),
    });
    const payload = await response.json().catch(() => null) as GeminiSessionPayload | null;
    if (!response.ok || !payload?.token || !payload.model || !payload.config) {
      microphone.getTracks().forEach((track) => track.stop());
      throw new Error(payload?.error ?? "Gemini Live could not start the caller session.");
    }

    const audioContext = new AudioContext();
    await audioContext.resume();
    let inputAnalyser = audioContext.createAnalyser();
    inputAnalyser.fftSize = 256;
    const outputAnalyser = audioContext.createAnalyser();
    outputAnalyser.fftSize = 256;
    const outputGain = audioContext.createGain();
    outputGain.connect(outputAnalyser).connect(audioContext.destination);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentSink = audioContext.createGain();
    silentSink.gain.value = 0;
    processor.connect(silentSink).connect(audioContext.destination);
    let inputSource = audioContext.createMediaStreamSource(microphone);
    inputSource.connect(inputAnalyser);
    inputSource.connect(processor);

    let ended = false;
    let muted = false;
    let outputVolume = 1;
    let frame = 0;
    let nextPlayTime = audioContext.currentTime;
    let inputTranscript = "";
    let outputTranscript = "";
    let modelSpeaking = false;
    let pendingDirection: string | null = null;
    let session: Session;
    const playing = new Set<AudioBufferSourceNode>();

    const applyPendingDirection = () => {
      if (!pendingDirection) return;
      const direction = pendingDirection;
      pendingDirection = null;
      session.sendClientContent({ turns: `Live producer direction: ${direction}`, turnComplete: false });
      config.onStatus?.("Caller direction updated");
    };

    const stopPlayback = () => {
      for (const source of playing) {
        try { source.stop(); } catch { /* Already stopped. */ }
      }
      playing.clear();
      nextPlayTime = audioContext.currentTime;
    };

    const playChunk = (encoded: string) => {
      if (ended) return;
      const source = audioContext.createBufferSource();
      source.buffer = pcmAudioBuffer(audioContext, encoded);
      source.connect(outputGain);
      const start = Math.max(audioContext.currentTime + 0.015, nextPlayTime);
      nextPlayTime = start + source.buffer.duration;
      playing.add(source);
      source.onended = () => playing.delete(source);
      source.start(start);
      modelSpeaking = true;
      config.onStatus?.("Caller speaking");
    };

    const flushTranscript = (speaker: "HOST" | "CALLER") => {
      const value = (speaker === "HOST" ? inputTranscript : outputTranscript).trim();
      if (value) config.onTranscript?.({ speaker, text: value });
      if (speaker === "HOST") inputTranscript = "";
      else outputTranscript = "";
    };

    const handleMessage = (message: LiveServerMessage) => {
      const content = message.serverContent;
      for (const part of content?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) playChunk(part.inlineData.data);
      }
      if (content?.inputTranscription?.text) inputTranscript += content.inputTranscription.text;
      if (content?.outputTranscription?.text) outputTranscript += content.outputTranscription.text;
      if (content?.inputTranscription?.finished) flushTranscript("HOST");
      if (content?.outputTranscription?.finished) flushTranscript("CALLER");
      if (content?.interrupted) {
        modelSpeaking = false;
        stopPlayback();
        config.onStatus?.("Caller interrupted");
      }
      if (content?.turnComplete) {
        modelSpeaking = false;
        flushTranscript("HOST");
        flushTranscript("CALLER");
        config.onStatus?.(content.waitingForInput ? "Waiting for host" : "Listening");
        applyPendingDirection();
      }
    };

    config.onStatus?.("Connecting to Gemini Live…");
    const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } });
    try {
      session = await ai.live.connect({
        model: payload.model,
        config: payload.config,
        callbacks: {
          onopen: () => config.onStatus?.("Gemini caller connected"),
          onmessage: handleMessage,
          onerror: (event) => config.onError?.(event.message || "Gemini Live session error."),
          onclose: () => { if (!ended) config.onStatus?.("Gemini caller disconnected"); },
        },
      });
    } catch (error) {
      microphone.getTracks().forEach((track) => track.stop());
      inputSource.disconnect();
      processor.disconnect();
      outputGain.disconnect();
      await audioContext.close();
      throw error;
    }

    processor.onaudioprocess = (event) => {
      if (ended) return;
      session.sendRealtimeInput({
        audio: { data: pcmBase64(event.inputBuffer.getChannelData(0)), mimeType: `audio/pcm;rate=${audioContext.sampleRate}` },
      });
    };

    const measure = () => {
      if (ended) return;
      config.onLevels?.({
        input: level(inputAnalyser),
        output: level(outputAnalyser),
        inputBands: frequencyBands(inputAnalyser),
        outputBands: frequencyBands(outputAnalyser),
      });
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    session.sendClientContent({ turns: "You have just been put through to the host live. Open with one natural caller sentence about why you rang. Do not introduce your role, capabilities or character brief.", turnComplete: true });

    const replaceInput = async (deviceId: string) => {
      const next = await getMicrophone(deviceId);
      inputSource.disconnect();
      microphone.getTracks().forEach((track) => track.stop());
      microphone = next;
      inputAnalyser.disconnect();
      inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputSource = audioContext.createMediaStreamSource(microphone);
      inputSource.connect(inputAnalyser);
      inputSource.connect(processor);
    };

    const updateGain = () => { outputGain.gain.value = muted ? 0 : outputVolume; };
    return {
      async updateInstructions(instructions) {
        if (modelSpeaking) {
          pendingDirection = instructions;
          config.onStatus?.("Caller direction queued for next reply");
          return;
        }
        session.sendClientContent({ turns: `Live producer direction: ${instructions}`, turnComplete: false });
        config.onStatus?.("Caller direction updated");
      },
      async interrupt() {
        stopPlayback();
        // Ordered client content always interrupts an in-flight model turn.
        session.sendClientContent({ turns: "[The host interrupts. Stop your current answer immediately and listen for the next question.]", turnComplete: false });
      },
      async muteOutput(nextMuted) { muted = nextMuted; updateGain(); },
      async setOutputVolume(volume) { outputVolume = clamp(volume); updateGain(); },
      async switchInputDevice(deviceId) { await replaceInput(deviceId); },
      async endSession() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        processor.onaudioprocess = null;
        session.sendRealtimeInput({ audioStreamEnd: true });
        session.close();
        stopPlayback();
        microphone.getTracks().forEach((track) => track.stop());
        inputSource.disconnect();
        processor.disconnect();
        silentSink.disconnect();
        outputGain.disconnect();
        await audioContext.close();
      },
    };
  }
}
