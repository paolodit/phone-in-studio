"use client";

import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";

type TranscriptEntry = { speaker: "HOST" | "CALLER"; text: string };
type FishConnectPayload = { model?: string; latency?: string; hasSelectedVoice?: boolean; error?: string };

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function microphoneIssue() {
  if (!window.isSecureContext) return `Live caller audio is blocked at ${window.location.origin}. Open http://localhost:3000 on this computer, or use HTTPS.`;
  if (!navigator.mediaDevices?.getUserMedia) return "This browser does not expose microphone access. Use Chrome or Edge on desktop and allow microphone permission.";
  if (typeof MediaRecorder === "undefined") return "This browser cannot record a host turn for Fish Audio. Use current Chrome or Edge on desktop.";
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
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error("Microphone permission was blocked. Allow microphone access for this site, then connect the Fish caller again.");
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

function recorderOptions() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}

export class FishAudioVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    config.onStatus?.("Requesting microphone permission…");
    let microphone = await getMicrophone(config.inputDeviceId);
    const connection = await fetch("/api/fish/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: config.showId, callerId: config.callerId, testMode: config.testMode ?? false }),
    });
    const connectionPayload = await connection.json().catch(() => null) as FishConnectPayload | null;
    if (!connection.ok) {
      microphone.getTracks().forEach((track) => track.stop());
      throw new Error(connectionPayload?.error ?? "Fish Audio could not prepare this caller.");
    }

    const audioContext = new AudioContext();
    await audioContext.resume();
    let inputSource = audioContext.createMediaStreamSource(microphone);
    let inputAnalyser = audioContext.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputSource.connect(inputAnalyser);
    const outputAnalyser = audioContext.createAnalyser();
    outputAnalyser.fftSize = 256;
    const outputGain = audioContext.createGain();
    outputGain.connect(outputAnalyser).connect(audioContext.destination);

    let ended = false;
    let inputMuted = false;
    let outputMuted = false;
    let outputVolume = 1;
    let busy = false;
    let callerSpeaking = false;
    let frame = 0;
    let recorder = new MediaRecorder(microphone, recorderOptions());
    let captureChunks: Blob[] = [];
    let captureStartedAt = 0;
    let lastVoiceAt = 0;
    let lastFrameAt = performance.now();
    let voicedMs = 0;
    let submitCapture = false;
    let noiseFloor = 0.012;
    let producerDirection = "";
    let activeSource: AudioBufferSourceNode | null = null;
    let activeTurnAbort: AbortController | null = null;
    let transcript: TranscriptEntry[] = [];
    let turnQueue = Promise.resolve();

    const statusListening = () => config.onStatus?.("Fish caller listening · pause after a full host sentence");
    const appendTranscript = (entry: TranscriptEntry) => {
      transcript = [...transcript, entry].slice(-30);
    };

    const responseError = async (response: Response, fallback: string) => {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      return new Error(payload?.error ?? fallback);
    };

    const stopPlayback = () => {
      if (!activeSource) return;
      try { activeSource.stop(); } catch { /* Playback already ended. */ }
      activeSource = null;
      callerSpeaking = false;
    };

    const playCallerAudio = async (buffer: AudioBuffer) => {
      await new Promise<void>((resolve) => {
        const source = audioContext.createBufferSource();
        activeSource = source;
        source.buffer = buffer;
        source.connect(outputGain);
        source.onended = () => {
          if (activeSource === source) activeSource = null;
          callerSpeaking = false;
          resolve();
        };
        callerSpeaking = true;
        config.onStatus?.("Fish caller speaking");
        source.start();
      });
    };

    const runCallerTurn = async (opening: boolean) => {
      if (ended) return;
      busy = true;
      activeTurnAbort = new AbortController();
      try {
        config.onStatus?.(opening ? "Preparing the Fish caller's opening…" : "Fish caller thinking…");
        const response = await fetch("/api/fish/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: config.showId,
            callerId: config.callerId,
            testMode: config.testMode ?? false,
            opening,
            producerDirection: producerDirection || undefined,
            transcript,
          }),
          signal: activeTurnAbort.signal,
        });
        if (!response.ok) throw await responseError(response, "The Fish caller could not prepare a reply.");
        const payload = await response.json() as { text?: string };
        if (!payload.text) throw new Error("The Fish caller returned an empty reply.");
        producerDirection = "";
        config.onStatus?.(`Rendering with Fish ${connectionPayload?.model ?? "Audio"}…`);
        const speech = await fetch("/api/fish/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: config.showId,
            callerId: config.callerId,
            testMode: config.testMode ?? false,
            text: payload.text,
          }),
          signal: activeTurnAbort.signal,
        });
        if (!speech.ok) throw await responseError(speech, "Fish Audio could not render the caller voice.");
        const audio = await audioContext.decodeAudioData(await speech.arrayBuffer());
        await playCallerAudio(audio);
        appendTranscript({ speaker: "CALLER", text: payload.text });
        config.onTranscript?.({ speaker: "CALLER", text: payload.text });
      } catch (error) {
        if (!ended && !(error instanceof DOMException && error.name === "AbortError")) {
          config.onError?.(error instanceof Error ? error.message : "The Fish caller turn failed.");
        }
      } finally {
        activeTurnAbort = null;
        busy = false;
        if (!ended && !inputMuted) statusListening();
      }
    };

    const enqueueCallerTurn = (opening: boolean) => {
      const task = turnQueue.then(() => runCallerTurn(opening));
      turnQueue = task.catch(() => undefined);
      return task;
    };

    const processHostAudio = async (audio: Blob) => {
      if (ended) return;
      busy = true;
      try {
        config.onStatus?.("Fish Audio transcribing the host…");
        const body = new FormData();
        body.append("showId", config.showId);
        body.append("callerId", config.callerId);
        body.append("testMode", String(config.testMode ?? false));
        body.append("audio", audio, `host-turn.${audio.type.includes("ogg") ? "ogg" : "webm"}`);
        const response = await fetch("/api/fish/transcribe", { method: "POST", body });
        if (!response.ok) throw await responseError(response, "Fish Audio could not transcribe the host.");
        const payload = await response.json() as { text?: string };
        const text = payload.text?.trim();
        if (!text) {
          config.onStatus?.("No clear host speech heard · listening again");
          return;
        }
        appendTranscript({ speaker: "HOST", text });
        config.onTranscript?.({ speaker: "HOST", text });
        await enqueueCallerTurn(false);
      } catch (error) {
        if (!ended) config.onError?.(error instanceof Error ? error.message : "The Fish host turn failed.");
      } finally {
        busy = false;
        if (!ended && !inputMuted) statusListening();
      }
    };

    const bindRecorder = () => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) captureChunks.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = captureChunks;
        const shouldSubmit = submitCapture && voicedMs >= 300;
        captureChunks = [];
        submitCapture = false;
        captureStartedAt = 0;
        lastVoiceAt = 0;
        voicedMs = 0;
        if (shouldSubmit && chunks.length) void processHostAudio(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        else if (!ended && !inputMuted && !busy) statusListening();
      };
    };
    bindRecorder();

    const stopCapture = (submit: boolean) => {
      if (recorder.state !== "recording") return;
      submitCapture = submit;
      recorder.stop();
    };

    const measure = () => {
      if (ended) return;
      const now = performance.now();
      const delta = Math.min(50, now - lastFrameAt);
      lastFrameAt = now;
      const input = level(inputAnalyser);
      config.onLevels?.({
        input,
        output: level(outputAnalyser),
        inputBands: frequencyBands(inputAnalyser),
        outputBands: frequencyBands(outputAnalyser),
      });

      const eligible = !busy && !callerSpeaking && !inputMuted;
      const threshold = Math.min(0.18, Math.max(0.05, noiseFloor * 3.4));
      if (eligible && recorder.state === "inactive") {
        if (input < threshold) noiseFloor = noiseFloor * 0.98 + input * 0.02;
        if (input >= threshold) {
          captureChunks = [];
          captureStartedAt = now;
          lastVoiceAt = now;
          voicedMs = delta;
          recorder.start(200);
          config.onStatus?.("Host speaking · pause when finished");
        }
      } else if (eligible && recorder.state === "recording") {
        if (input >= threshold) {
          lastVoiceAt = now;
          voicedMs += delta;
        }
        if (now - captureStartedAt >= 25_000 || (voicedMs >= 300 && now - lastVoiceAt >= 950)) stopCapture(true);
        else if (voicedMs < 300 && now - lastVoiceAt >= 1_200) stopCapture(false);
      } else if (recorder.state === "recording") {
        stopCapture(false);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    config.onStatus?.(`Fish ${connectionPayload?.model ?? "Audio"} connected · turn-based mode`);
    void enqueueCallerTurn(true);

    const replaceInput = async (deviceId: string) => {
      stopCapture(false);
      const next = await getMicrophone(deviceId);
      inputSource.disconnect();
      microphone.getTracks().forEach((track) => track.stop());
      microphone = next;
      inputAnalyser.disconnect();
      inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputSource = audioContext.createMediaStreamSource(microphone);
      inputSource.connect(inputAnalyser);
      recorder = new MediaRecorder(microphone, recorderOptions());
      bindRecorder();
      noiseFloor = 0.012;
    };

    const updateGain = () => { outputGain.gain.value = outputMuted ? 0 : outputVolume; };
    return {
      async updateInstructions(instructions) {
        producerDirection = instructions;
        config.onStatus?.("Fish caller direction saved for the next reply");
      },
      async sendHostText(text) {
        appendTranscript({ speaker: "HOST", text });
        await enqueueCallerTurn(false);
      },
      async interrupt() {
        activeTurnAbort?.abort();
        stopPlayback();
        busy = false;
        if (!ended && !inputMuted) statusListening();
      },
      async muteInput(muted) {
        inputMuted = muted;
        if (muted) stopCapture(false);
        else if (!busy && !callerSpeaking) statusListening();
      },
      async muteOutput(muted) { outputMuted = muted; updateGain(); },
      async setOutputVolume(volume) { outputVolume = clamp(volume); updateGain(); },
      async switchInputDevice(deviceId) { await replaceInput(deviceId); },
      async endSession() {
        if (ended) return;
        ended = true;
        activeTurnAbort?.abort();
        cancelAnimationFrame(frame);
        stopCapture(false);
        stopPlayback();
        microphone.getTracks().forEach((track) => track.stop());
        inputSource.disconnect();
        outputGain.disconnect();
        await audioContext.close();
      },
    };
  }
}
