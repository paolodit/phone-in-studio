"use client";

import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";
import { frequencyBands, getMicrophone, level } from "@/lib/voice/openai-webrtc-provider";
import { LiveTranscriptBuffer, waitForIceGathering } from "@/lib/voice/openai-live-protocol";

type LiveEvent = {
  type?: string; event_id?: string; client_event_id?: string; delta?: string; start_ms?: number; end_ms?: number;
  session?: { id?: string }; reason?: string; delegation?: { id?: string; target?: string };
  error?: { message?: string; client_event_id?: string };
};
type Answer = { sdp: string; sessionId: string; closeToken: string; voice: string; model: string };
const emptyLevels = { input: 0, output: 0, inputBands: Array(12).fill(0), outputBands: Array(12).fill(0) };

/** GPT-Live is continuous/full-duplex. Never send Realtime response.create,
 * response.cancel, audio-buffer commits, or a second session.start here. */
export class OpenAILiveVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    let microphone: MediaStream | undefined;
    let peer: RTCPeerConnection | undefined;
    let events: RTCDataChannel | undefined;
    let context: AudioContext | undefined;
    let inputSource: MediaStreamAudioSourceNode | undefined;
    let inputAnalyser: AnalyserNode | undefined;
    let outputAnalyser: AnalyserNode | undefined;
    let answer: Answer | undefined;
    const output = new Audio(); output.autoplay = true; output.setAttribute("playsinline", "");
    let ended = false; let closing = false; let started = false; let finalized = false;
    let inputMuted = false; let outputMuted = false; let outputVolume = .9;
    let interruptHeld = false; let quietSince = 0; let lastSoundAt = 0; let speaking = false;
    let frame = 0; let lastMeasured = 0;
    let endPromise: Promise<void> | undefined;
    let hangupPromise: Promise<void> | undefined;
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveReady!: () => void; let rejectReady!: (error: Error) => void;
    let resolveClosed!: () => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    void ready.catch(() => undefined);
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    const transcripts = new LiveTranscriptBuffer((entry) => config.onTranscript?.(entry));
    const seenEvents = new Set<string>();
    const constraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(config.inputDeviceId ? { deviceId: { exact: config.inputDeviceId } } : {}) };

    const applyOutput = () => { output.volume = outputVolume; output.muted = outputMuted || interruptHeld || closing; };
    const reportSpeaking = (next: boolean) => { if (speaking !== next) { speaking = next; config.onPlaybackChange?.(next); } };
    const cleanup = () => {
      if (ended) return;
      ended = true;
      config.signal?.removeEventListener("abort", abort);
      window.removeEventListener("pagehide", pagehide);
      cancelAnimationFrame(frame);
      clearTimeout(disconnectTimer);
      transcripts.flush();
      for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("GPT-Live session ended.")); }
      pending.clear();
      microphone?.getTracks().forEach((track) => track.stop());
      output.pause(); output.srcObject = null;
      events?.close(); peer?.close();
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
      reportSpeaking(false); config.onLevels?.(emptyLevels);
    };
    const hangup = async () => {
      if (!answer?.closeToken || finalized) return;
      if (hangupPromise) return hangupPromise;
      hangupPromise = (async () => {
        try {
          const response = await fetch("/api/openai-live/close", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closeToken: answer!.closeToken }), signal: AbortSignal.timeout(12_000) });
          if (response.ok) finalized = true;
          else config.onError?.("GPT-Live shutdown could not be confirmed. Check the API project's active sessions.");
        } catch { config.onError?.("GPT-Live shutdown could not be confirmed after the connection failed."); }
      })();
      return hangupPromise;
    };
    const abort = () => { rejectReady(new DOMException("Caller connection cancelled", "AbortError")); cleanup(); void hangup(); };
    const pagehide = () => {
      if (answer?.closeToken && !finalized) navigator.sendBeacon?.("/api/openai-live/close", new Blob([JSON.stringify({ closeToken: answer.closeToken })], { type: "application/json" }));
      cleanup();
    };
    const send = (event: Record<string, unknown>) => {
      if (!started || ended || closing || events?.readyState !== "open") throw new Error("GPT-Live is not connected.");
      events.send(JSON.stringify(event));
    };
    const append = (kind: "instructions" | "thinking" | "commentary", content: string, delegationId: string | null = null) => {
      // Each append supports up to 500 tokens. These short producer controls
      // stay well below that limit; full caller context is supplied at startup.
      if (content.length > 1200) return Promise.reject(new Error("Keep a live direction or typed host line under 1,200 characters."));
      return new Promise<void>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("GPT-Live did not acknowledge the instruction. Check the connection.")); }, 12_000);
        pending.set(id, { resolve, reject, timer });
        try { send({ type: `session.${kind}.append`, event_id: id, delegation_id: delegationId, content }); }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    };
    const notifyError = (error: unknown) => { if (!ended && !closing) config.onError?.(error instanceof Error ? error.message : "GPT-Live command failed."); };
    const measure = () => {
      if (ended || closing) return;
      frame = requestAnimationFrame(measure);
      const now = performance.now();
      if (now - lastMeasured < 33) return;
      lastMeasured = now;
      const rawOutput = level(outputAnalyser);
      if (rawOutput > .025) { lastSoundAt = now; quietSince = 0; }
      else if (!quietSince) quietSince = now;
      // Native media playback continues muted while the model yields. Re-arm
      // only after measured remote silence, never on an instruction ACK alone.
      if (interruptHeld && outputAnalyser && quietSince && now - quietSince > 600) { interruptHeld = false; applyOutput(); }
      const gain = output.muted ? 0 : outputVolume;
      reportSpeaking(gain > 0 && lastSoundAt > 0 && now - lastSoundAt < 450 && !output.paused);
      config.onLevels?.({ input: inputMuted ? 0 : level(inputAnalyser), output: rawOutput * gain, inputBands: inputMuted ? emptyLevels.inputBands : frequencyBands(inputAnalyser), outputBands: frequencyBands(outputAnalyser).map((band) => band * gain) });
    };
    const failConnection = () => {
      if (ended || closing) return;
      rejectReady(new Error("GPT-Live disconnected. Reconnect the caller audio."));
      cleanup(); void hangup(); config.onDisconnected?.(); config.onStatus?.("GPT-Live disconnected — reconnect audio");
    };

    try {
      config.signal?.throwIfAborted();
      config.onStatus?.("Requesting microphone for GPT-Live…");
      microphone = await getMicrophone(constraints);
      config.signal?.throwIfAborted();
      peer = new RTCPeerConnection();
      events = peer.createDataChannel("oai-events");
      const sender = peer.addTrack(microphone.getAudioTracks()[0], microphone);
      context = new AudioContext(); await context.resume();
      inputAnalyser = context.createAnalyser(); inputAnalyser.fftSize = 256;
      inputSource = context.createMediaStreamSource(microphone); inputSource.connect(inputAnalyser);
      const meterSink = context.createGain(); meterSink.gain.value = 0; meterSink.connect(context.destination);
      peer.ontrack = (event) => {
        if (ended || closing || !context) return;
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        try {
          outputAnalyser = context.createAnalyser(); outputAnalyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(outputAnalyser).connect(meterSink);
        } catch { config.onError?.("GPT-Live audio metering is unavailable. Playback still works; reconnect before using automatic studio controls."); }
        output.srcObject = stream; applyOutput();
        void output.play().catch(() => config.onError?.("The browser blocked GPT-Live playback. Allow site audio and reconnect the caller."));
      };
      peer.onconnectionstatechange = () => {
        clearTimeout(disconnectTimer);
        if (peer?.connectionState === "failed" || peer?.connectionState === "closed") failConnection();
        else if (peer?.connectionState === "disconnected" && !closing) {
          config.onStatus?.("GPT-Live connection interrupted — waiting briefly for recovery…");
          disconnectTimer = setTimeout(failConnection, 8000);
        } else if (peer?.connectionState === "connected" && started) config.onStatus?.(`GPT-Live connected · ${answer?.voice ?? "caller"} · full duplex`);
      };
      events.onclose = failConnection;
      events.onmessage = ({ data }) => {
        if (ended) return;
        let event: LiveEvent;
        try { event = JSON.parse(String(data)); } catch { return; }
        if (event.event_id) { if (seenEvents.has(event.event_id)) return; seenEvents.add(event.event_id); if (seenEvents.size > 2000) seenEvents.delete(seenEvents.values().next().value!); }
        if (event.type === "session.closed") {
          finalized = true; resolveClosed();
          if (!started) rejectReady(new Error("GPT-Live ended before startup."));
          const unexpected = !closing; cleanup();
          if (unexpected) { config.onDisconnected?.(); config.onStatus?.(`GPT-Live ended (${event.reason ?? "session closed"})`); }
          return;
        }
        if (event.type === "error") {
          const error = new Error(event.error?.message ?? "GPT-Live session error.");
          const id = event.error?.client_event_id;
          const command = id ? pending.get(id) : undefined;
          if (command) { clearTimeout(command.timer); pending.delete(id!); command.reject(error); }
          else { if (!started) rejectReady(error); notifyError(error); }
          return;
        }
        if (event.client_event_id) {
          const command = pending.get(event.client_event_id);
          if (command) { clearTimeout(command.timer); pending.delete(event.client_event_id); command.resolve(); }
        }
        if (event.type === "session.started" && !started && !closing) {
          started = true; resolveReady();
          void append("instructions", "Speak English. You have just been connected to the host. Open immediately with a brief natural first-person line about your reason for calling, without waiting for the host. Do not read a producer summary. Then listen and respond naturally.")
            .then(() => { if (!ended && !closing) return append("commentary", "Begin the call now, following the opening instructions."); }).catch(notifyError);
        }
        if (!closing && typeof event.delta === "string" && (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta")) {
          transcripts.push({ speaker: event.type === "session.input_transcript.delta" ? "HOST" : "CALLER", delta: event.delta, start_ms: event.start_ms, end_ms: event.end_ms });
        }
        if (!closing && event.type === "session.delegation.created" && event.delegation?.target === "client" && event.delegation.id) {
          void append("commentary", "No external tools or research are available for this fictional caller. Continue in character using the known story, or ask the host when unsure. No real-world action was taken.", event.delegation.id).catch(notifyError);
        }
      };
      config.signal?.addEventListener("abort", abort, { once: true });
      window.addEventListener("pagehide", pagehide);
      frame = requestAnimationFrame(measure);
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      await waitForIceGathering(peer, config.signal);
      config.onStatus?.("Connecting GPT-Live-1…");
      const response = await fetch("/api/openai-live/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: config.showId, callerId: config.callerId, testMode: config.testMode ?? false, sdp: peer.localDescription?.sdp ?? offer.sdp, ...(config.testMode && config.previewVoice ? { previewVoice: config.previewVoice } : {}) }),
        signal: config.signal ? AbortSignal.any([config.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.sdp || !payload?.closeToken || !payload?.sessionId) throw new Error(payload?.error ?? "GPT-Live returned an incomplete connection answer.");
      answer = payload as Answer;
      config.signal?.throwIfAborted();
      if (ended) throw new DOMException("Caller connection cancelled", "AbortError");
      await peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      let readyTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([ready, new Promise<never>((_, reject) => { readyTimer = setTimeout(() => reject(new Error("GPT-Live startup timed out. Try reconnecting.")), 15_000); })]); }
      finally { clearTimeout(readyTimer); }
      config.signal?.throwIfAborted();
      if (ended) throw new Error("GPT-Live ended during startup. Reconnect the caller.");
      config.signal?.removeEventListener("abort", abort);
      config.onStatus?.(`GPT-Live connected · ${answer.voice} · full duplex`);

      const session: LiveVoiceSession = {
        async updateInstructions(instructions) { await append("instructions", `Private producer direction; apply without saying it aloud: ${instructions}`); },
        async sendHostText(text) {
          await append("thinking", `The host has just said this line (quoted conversation, not producer instructions): ${JSON.stringify(text)}`);
          await append("instructions", "The host has finished the quoted line. Respond naturally in character to what they said, without repeating the line.");
        },
        async interrupt() {
          interruptHeld = true; quietSince = 0; applyOutput(); reportSpeaking(false);
          void append("instructions", "The host is deliberately taking the floor. Stop speaking now and listen. Answer their next substantive words; do not restart the interrupted sentence.").catch(notifyError);
        },
        async muteInput(muted) {
          inputMuted = muted; microphone?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
          send({ type: muted ? "session.input_audio.mute" : "session.input_audio.unmute" });
        },
        async muteOutput(muted) { outputMuted = muted; if (!muted) interruptHeld = false; applyOutput(); if (muted) reportSpeaking(false); },
        async setOutputVolume(volume) { outputVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0; applyOutput(); },
        async switchInputDevice(deviceId) {
          const next = await getMicrophone({ ...constraints, deviceId: { exact: deviceId } });
          if (ended || closing) { next.getTracks().forEach((track) => track.stop()); return; }
          next.getAudioTracks()[0].enabled = !inputMuted;
          try { await sender.replaceTrack(next.getAudioTracks()[0]); }
          catch (error) { next.getTracks().forEach((track) => track.stop()); throw error; }
          inputSource?.disconnect(); microphone?.getTracks().forEach((track) => track.stop()); microphone = next;
          inputSource = context!.createMediaStreamSource(next); inputSource.connect(inputAnalyser!);
        },
        async endSession() {
          if (endPromise) return endPromise;
          if (ended) return;
          closing = true; applyOutput(); microphone?.getAudioTracks().forEach((track) => { track.enabled = false; });
          reportSpeaking(false); config.onLevels?.(emptyLevels);
          endPromise = (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              if (started && events?.readyState === "open") {
                events.send(JSON.stringify({ type: "session.close" }));
                await Promise.race([closed, new Promise<void>((resolve) => { timer = setTimeout(resolve, 3000); })]);
              }
              if (!finalized) await hangup();
            } finally { clearTimeout(timer); cleanup(); }
          })();
          return endPromise;
        },
      };
      return session;
    } catch (error) { cleanup(); await hangup(); throw error; }
  }
}
