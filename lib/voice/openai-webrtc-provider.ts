"use client";

import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";

type RealtimeEvent = { type?: string; transcript?: string; delta?: string; error?: { message?: string }; name?: string; call_id?: string; arguments?: string };

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
    const connection = new RTCPeerConnection();
    const output = new Audio();
    output.autoplay = true;
    output.volume = 1;
    const events = connection.createDataChannel("oai-events");
    let sender = connection.addTrack(microphone.getAudioTracks()[0], microphone);
    const audioContext = new AudioContext();
    await audioContext.resume();
    let inputAnalyser = audioContext.createAnalyser();
    inputAnalyser.fftSize = 256;
    audioContext.createMediaStreamSource(microphone).connect(inputAnalyser);
    let outputAnalyser: AnalyserNode | undefined;
    let frame = 0;
    let ended = false;
    let callerTranscript = "";

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

    connection.ontrack = (event) => {
      const stream = event.streams[0];
      output.srcObject = stream;
      const source = audioContext.createMediaStreamSource(stream);
      outputAnalyser = audioContext.createAnalyser();
      outputAnalyser.fftSize = 256;
      source.connect(outputAnalyser);
      void output.play().catch(() => config.onError?.("Browser blocked caller audio playback. Click Answer Call again."));
    };

    const send = (event: Record<string, unknown>) => {
      if (events.readyState === "open") events.send(JSON.stringify(event));
    };
    events.onopen = () => send({ type: "response.create" });
    events.onmessage = (message) => {
      let event: RealtimeEvent;
      try { event = JSON.parse(String(message.data)) as RealtimeEvent; } catch { return; }
      if (event.type === "error") config.onError?.(event.error?.message ?? "Realtime session error.");
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) config.onTranscript?.({ speaker: "HOST", text: event.transcript });
      if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") callerTranscript += event.delta ?? "";
      if ((event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") && (event.transcript || callerTranscript)) {
        config.onTranscript?.({ speaker: "CALLER", text: event.transcript ?? callerTranscript });
        callerTranscript = "";
      }
      if (event.type === "response.function_call_arguments.done" && event.name === "show_caller_visual" && event.arguments) {
        try {
          const args = JSON.parse(event.arguments) as { assetId?: string };
          if (!args.assetId) throw new Error("Tool call did not include an asset.");
          void config.onVisualTrigger?.(args.assetId).then(() => {
            send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok: true }) } });
            send({ type: "response.create" });
          }).catch((error: unknown) => config.onError?.(error instanceof Error ? error.message : "Visual trigger failed."));
        } catch (error) { config.onError?.(error instanceof Error ? error.message : "Visual trigger failed."); }
      }
      if (event.type === "input_audio_buffer.speech_started") config.onStatus?.("Host speaking");
      if (event.type === "response.output_audio.delta") config.onStatus?.("Caller speaking");
    };

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    config.onStatus?.("Connecting caller…");
    const answer = await fetch("/api/realtime/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: config.showId, callerId: config.callerId, sdp: offer.sdp ?? "" }),
    });
    const answerPayload = await answer.json().catch(() => null) as { sdp?: string; error?: string } | null;
    const closeFailedAttempt = async () => {
      ended = true;
      cancelAnimationFrame(frame);
      microphone.getTracks().forEach((track) => track.stop());
      output.pause();
      output.srcObject = null;
      events.close();
      connection.close();
      await audioContext.close();
    };
    if (!answer.ok || !answerPayload?.sdp) {
      await closeFailedAttempt();
      throw new Error(answerPayload?.error ?? "The live caller could not connect. Try Connect AI caller again.");
    }
    try {
      await connection.setRemoteDescription({ type: "answer", sdp: answerPayload.sdp });
    } catch (error) {
      await closeFailedAttempt();
      throw error;
    }
    config.onStatus?.("Caller connected");

    const replaceInput = async (deviceId: string) => {
      const next = await getMicrophone({ ...constraints, deviceId: { exact: deviceId } });
      const track = next.getAudioTracks()[0];
      await sender.replaceTrack(track);
      microphone.getTracks().forEach((oldTrack) => oldTrack.stop());
      microphone = next;
      sender = connection.getSenders().find((candidate) => candidate.track?.kind === "audio") ?? sender;
      inputAnalyser.disconnect();
      inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      audioContext.createMediaStreamSource(microphone).connect(inputAnalyser);
    };

    return {
      async updateInstructions(instructions) { send({ type: "session.update", session: { instructions } }); },
      async interrupt() {
        send({ type: "response.cancel" });
        send({ type: "output_audio_buffer.clear" });
      },
      async muteOutput(muted) { output.muted = muted; },
      async setOutputVolume(volume) { output.volume = Math.max(0, Math.min(1, volume)); },
      async switchInputDevice(deviceId) { await replaceInput(deviceId); },
      async endSession() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        microphone.getTracks().forEach((track) => track.stop());
        output.pause();
        output.srcObject = null;
        events.close();
        connection.close();
        await audioContext.close();
      },
    };
  }
}
