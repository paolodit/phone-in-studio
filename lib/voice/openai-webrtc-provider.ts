"use client";

import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";
import { RealtimeTurnTaking } from "@/lib/voice/turn-taking";

type RealtimeEvent = { type?: string; item_id?: string; transcript?: string; delta?: string; error?: { message?: string } };

export function microphoneAccessIssue(input: { isSecureContext: boolean; hasGetUserMedia: boolean; origin?: string }) {
  if (!input.isSecureContext) {
    return `Live caller audio is blocked at ${input.origin ?? "this address"}. Open http://localhost:3000 on this computer, or use HTTPS. A normal HTTP LAN/IP address cannot access the microphone.`;
  }
  if (!input.hasGetUserMedia) {
    return "This browser does not expose microphone access. Use Chrome or Edge on desktop, open the app on localhost or HTTPS, then allow microphone permission.";
  }
  return null;
}

function currentMicrophoneAccessIssue() {
  return microphoneAccessIssue({
    isSecureContext: window.isSecureContext,
    hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    origin: window.location.origin,
  });
}

async function getMicrophone(constraints: MediaTrackConstraints) {
  const issue = currentMicrophoneAccessIssue();
  if (issue) throw new Error(issue);
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: constraints });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error("Microphone permission was blocked. Allow microphone access for this site, then click Answer Call again.");
    if (name === "NotFoundError") throw new Error("No microphone was found. Connect or select a microphone, then click Answer Call again.");
    if (name === "NotReadableError") throw new Error("The microphone is busy in another application. Close the other application and try again.");
    throw error;
  }
}

function level(analyser: AnalyserNode | undefined) {
  if (!analyser) return 0;
  const values = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(values);
  const sum = values.reduce((total, value) => total + Math.abs(value - 128), 0);
  return Math.min(1, sum / values.length / 40);
}

function frequencyBands(analyser: AnalyserNode | undefined, count = 12) {
  if (!analyser) return Array.from({ length: count }, () => 0);
  const values = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(values);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * values.length));
    let total = 0;
    for (let bucket = start; bucket < end; bucket += 1) total += values[bucket] ?? 0;
    return Math.min(1, total / (end - start) / 180);
  });
}

export async function listMicrophones() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices())
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({ id: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
}

export class OpenAIWebRtcVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    config.onStatus?.("Requesting microphone permission…");
    const microphoneIssue = currentMicrophoneAccessIssue();
    if (microphoneIssue) throw new Error(microphoneIssue);
    const constraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (config.inputDeviceId) constraints.deviceId = { exact: config.inputDeviceId };
    let microphone = await getMicrophone(constraints);
    if (config.signal?.aborted) { microphone.getTracks().forEach((track) => track.stop()); config.signal.throwIfAborted(); }
    const connection = new RTCPeerConnection();
    const events = connection.createDataChannel("oai-events");
    let sender = connection.addTrack(microphone.getAudioTracks()[0], microphone);
    const audioContext = new AudioContext();
    await audioContext.resume();
    let inputAnalyser = audioContext.createAnalyser();
    inputAnalyser.fftSize = 256;
    let inputSource = audioContext.createMediaStreamSource(microphone);
    inputSource.connect(inputAnalyser);
    let outputAnalyser: AnalyserNode | undefined;
    // Keep playback on the browser's native WebRTC path. This is the supported
    // path for remote Realtime audio; the Web Audio graph below is monitor-only.
    const output = new Audio();
    output.autoplay = true;
    output.setAttribute("playsinline", "");
    const meterSink = audioContext.createGain();
    meterSink.gain.value = 0;
    let outputVolume = 1;
    let outputMuted = false;
    let inputMuted = false;
    let frame = 0;
    let ended = false;
    let callerTranscript = "";
    let lastMeasured = 0;
    let hostEndedAt: number | null = null;

    const measure = () => {
      if (ended) return;
      frame = requestAnimationFrame(measure);
      if (performance.now() - lastMeasured < 33) return;
      lastMeasured = performance.now();
      const audibleGain = outputMuted ? 0 : outputVolume;
      config.onLevels?.({
        input: level(inputAnalyser),
        output: level(outputAnalyser) * audibleGain,
        inputBands: frequencyBands(inputAnalyser),
        outputBands: frequencyBands(outputAnalyser).map((band) => band * audibleGain),
      });
    };
    frame = requestAnimationFrame(measure);

    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const source = audioContext.createMediaStreamSource(stream);
      outputAnalyser = audioContext.createAnalyser();
      outputAnalyser.fftSize = 256;
      // This branch only samples the remote stream for the caller-output meter.
      // Native <audio> playback remains independent, so a metering failure can
      // never silence a live caller.
      source.connect(outputAnalyser).connect(meterSink).connect(audioContext.destination);
      output.volume = outputVolume;
      output.muted = outputMuted;
      output.srcObject = stream;
      config.onStatus?.("Caller audio track received");
      void output.play().then(() => config.onStatus?.("Caller audio playing")).catch(() => {
        config.onError?.("The caller audio arrived but this browser could not play it. Check the selected speaker/output device, then reconnect the caller audio.");
      });
    };

    const send = (event: Record<string, unknown>) => {
      if (!ended && events.readyState === "open") events.send(JSON.stringify(event));
    };
    const turns = new RealtimeTurnTaking(send, config.interruptionMode !== "manual");
    let resolveReady: () => void;
    let rejectReady: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // Attach a handler before SDP negotiation so an early failure is not unhandled.
    void ready.catch(() => undefined);
    events.onopen = () => { turns.requestReply(); resolveReady(); };
    connection.onconnectionstatechange = () => {
      if (ended) return;
      if (connection.connectionState === "failed" || connection.connectionState === "closed") {
        rejectReady(new Error("Caller audio connection failed. Reconnect the caller to try again."));
        void closeFailedAttempt();
        config.onDisconnected?.();
        config.onStatus?.("Caller disconnected — reconnect audio");
      } else if (connection.connectionState === "disconnected") config.onStatus?.("Audio connection interrupted — reconnecting…");
    };
    events.onmessage = (message) => {
      if (ended) return;
      let event: RealtimeEvent;
      try { event = JSON.parse(String(message.data)) as RealtimeEvent; } catch { return; }
      if (event.type === "error") config.onError?.(event.error?.message ?? "Realtime session error.");
      if (event.type === "response.created") turns.responseStarted();
      if (event.type === "response.done") turns.responseFinished();
      if (event.type === "input_audio_buffer.speech_started" && event.item_id) {
        turns.speechStarted(event.item_id);
        config.onStatus?.("Hearing host");
      }
      if (event.type === "input_audio_buffer.speech_stopped") hostEndedAt = performance.now();
      if (event.type === "input_audio_buffer.committed" && event.item_id) turns.speechCommitted(event.item_id);
      if (event.type === "conversation.item.input_audio_transcription.delta" && event.item_id) turns.transcript(event.item_id, event.delta ?? "", false);
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.item_id) {
        turns.transcript(event.item_id, event.transcript ?? "", true);
        if (event.transcript) config.onTranscript?.({ speaker: "HOST", text: event.transcript });
      }
      if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") callerTranscript += event.delta ?? "";
      if ((event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") && (event.transcript || callerTranscript)) {
        config.onTranscript?.({ speaker: "CALLER", text: event.transcript ?? callerTranscript });
        callerTranscript = "";
      }
      // WebRTC audio is a media track, not response.output_audio.delta events.
      if (event.type === "output_audio_buffer.started") {
        turns.playbackChanged(true);
        config.onPlaybackChange?.(true);
        config.onStatus?.("Caller speaking");
        if (hostEndedAt !== null) config.onReplyLatency?.(Math.round(performance.now() - hostEndedAt));
        hostEndedAt = null;
      }
      if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
        turns.playbackChanged(false);
        config.onPlaybackChange?.(false);
        config.onStatus?.("Listening for host");
      }
    };

    const closeFailedAttempt = async () => {
      if (ended) return;
      ended = true;
      config.signal?.removeEventListener("abort", abortAttempt);
      cancelAnimationFrame(frame);
      microphone.getTracks().forEach((track) => track.stop());
      output.pause();
      output.srcObject = null;
      meterSink.disconnect();
      events.close();
      connection.close();
      await audioContext.close();
    };
    const abortAttempt = () => {
      rejectReady(new DOMException("Caller connection cancelled", "AbortError"));
      void closeFailedAttempt();
    };
    config.signal?.addEventListener("abort", abortAttempt, { once: true });
    let answerPayload: { sdp?: string; instructions?: string; error?: string } | null = null;
    let readyTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      config.signal?.throwIfAborted();
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      config.onStatus?.("Connecting caller…");
      const answer = await fetch("/api/realtime/call", {
        method: "POST", signal: config.signal ? AbortSignal.any([config.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: config.showId, callerId: config.callerId, testMode: config.testMode ?? false, sdp: offer.sdp ?? "" }),
      });
      answerPayload = await answer.json().catch(() => null);
      if (!answer.ok || !answerPayload?.sdp) throw new Error(answerPayload?.error ?? "The live caller could not connect. Try connecting again.");
      await connection.setRemoteDescription({ type: "answer", sdp: answerPayload.sdp });
      readyTimeout = setTimeout(() => rejectReady(new Error("Caller connection timed out. Check the network, then reconnect audio.")), 15_000);
      await ready;
    } catch (error) {
      await closeFailedAttempt();
      throw error;
    } finally { clearTimeout(readyTimeout); config.signal?.removeEventListener("abort", abortAttempt); }
    config.onStatus?.("Caller connected");

    const replaceInput = async (deviceId: string) => {
      const next = await getMicrophone({ ...constraints, deviceId: { exact: deviceId } });
      const track = next.getAudioTracks()[0];
      track.enabled = !inputMuted;
      try { await sender.replaceTrack(track); } catch (error) { next.getTracks().forEach((item) => item.stop()); throw error; }
      inputSource.disconnect();
      microphone.getTracks().forEach((oldTrack) => oldTrack.stop());
      microphone = next;
      sender = connection.getSenders().find((candidate) => candidate.track?.kind === "audio") ?? sender;
      inputAnalyser.disconnect();
      inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputSource = audioContext.createMediaStreamSource(microphone);
      inputSource.connect(inputAnalyser);
    };

    return {
      async updateInstructions(instructions) {
        const baseInstructions = answerPayload?.instructions || config.instructions;
        send({ type: "session.update", session: { type: "realtime", instructions: `${baseInstructions}\n\n# Live producer direction\n${instructions}` } });
      },
      async sendHostText(text) {
        send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
        turns.requestReply();
      },
      async interrupt() {
        turns.takeFloor();
        config.onPlaybackChange?.(false);
      },
      async muteInput(muted) { inputMuted = muted; microphone.getAudioTracks().forEach((track) => { track.enabled = !muted; }); },
      setInterruptionMode(mode) { turns.setGuarded(mode === "guarded"); },
      async muteOutput(muted) {
        outputMuted = muted;
        output.muted = outputMuted;
      },
      async setOutputVolume(volume) {
        outputVolume = Math.max(0, Math.min(1, volume));
        output.volume = outputVolume;
      },
      async switchInputDevice(deviceId) { await replaceInput(deviceId); },
      async endSession() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        microphone.getTracks().forEach((track) => track.stop());
        output.pause();
        output.srcObject = null;
        meterSink.disconnect();
        events.close();
        connection.close();
        await audioContext.close();
      },
    };
  }
}
