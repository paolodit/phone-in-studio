"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Images } from "lucide-react";
import type { BroadcastSnapshot } from "@/lib/public-show";
import type { StudioControlAction } from "@/lib/schemas";
import type { StudioState } from "@/lib/studio-state";
import type { LiveVoiceSession } from "@/lib/voice/types";
import type { VoiceProviderId } from "@/lib/show-format";
import { ElevenLabsAgentVoiceProvider } from "@/lib/voice/elevenlabs-agent-provider";
import { GeminiLiveVoiceProvider } from "@/lib/voice/gemini-live-provider";
import { listMicrophones, OpenAIWebRtcVoiceProvider } from "@/lib/voice/openai-webrtc-provider";
import { QueueOrderEditor } from "@/components/QueueOrderEditor";
import { buildLiveDirectionInstructions, neutralLiveDirection, type LiveDirection } from "@/lib/live-direction";

const text = (value: unknown) => typeof value === "string" ? value : "-";
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const emptyLevels = { input: 0, output: 0, inputBands: Array.from({ length: 12 }, () => 0), outputBands: Array.from({ length: 12 }, () => 0) };
const directionLabels = {
  energy: ["Very calm", "Calmer", "Baseline", "Livelier", "Animated"],
  pace: ["Much slower", "Slower", "Baseline", "Faster", "Much faster"],
  answerLength: ["Very brief", "Shorter", "Baseline", "Fuller", "Longest"],
};

function playSynthCue(effect: "incoming" | "connected" | "hostHangup" | "callerHangup" | "cheer" | "horn" | "rimshot") {
  const patterns = {
    incoming: { notes: [660, 880], type: "sine" as OscillatorType, duration: 0.11 },
    connected: { notes: [740, 988], type: "sine" as OscillatorType, duration: 0.1 },
    hostHangup: { notes: [520, 340], type: "square" as OscillatorType, duration: 0.13 },
    callerHangup: { notes: [440, 300], type: "sine" as OscillatorType, duration: 0.15 },
    cheer: { notes: [392, 494, 587, 698], type: "triangle" as OscillatorType, duration: 0.09 },
    horn: { notes: [233, 277], type: "sawtooth" as OscillatorType, duration: 0.22 },
    rimshot: { notes: [180, 880], type: "square" as OscillatorType, duration: 0.07 },
  }[effect];
  const context = new AudioContext();
  const start = context.currentTime;
  patterns.notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = start + index * (patterns.duration + 0.025);
    oscillator.type = patterns.type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(effect === "horn" ? 0.07 : 0.12, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + patterns.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + patterns.duration + 0.01);
  });
  window.setTimeout(() => void context.close(), patterns.notes.length * (patterns.duration + 0.025) * 1_000 + 250);
}

const eventTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "-" : `${date.toISOString().slice(11, 19)} UTC`;
};

export function StudioClient({
  showId,
  initialSnapshot,
  initialStudioState,
  initialVoiceProvider,
}: {
  showId: string;
  initialSnapshot: BroadcastSnapshot;
  initialStudioState: StudioState;
  initialVoiceProvider: VoiceProviderId;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [studioState, setStudioState] = useState(initialStudioState);
  const [message, setMessage] = useState("Start the show, cue a caller, then answer the call to connect browser voice.");
  const [voiceStatus, setVoiceStatus] = useState("No browser voice session");
  const [inputDevices, setInputDevices] = useState<{ id: string; label: string }[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [levels, setLevels] = useState(emptyLevels);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProviderId>(initialVoiceProvider);
  const [sessionConnected, setSessionConnected] = useState(false);
  const [liveDirection, setLiveDirection] = useState<LiveDirection>({ ...neutralLiveDirection });
  const [transcript, setTranscript] = useState<{ speaker: "HOST" | "CALLER"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [mediaPane, setMediaPane] = useState<"visuals" | "soundboard">("visuals");
  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const directionAppliedRef = useRef(false);
  const soundRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastAudioLevelSent = useRef(0);
  const url = useMemo(() => `/api/shows/${showId}/events`, [showId]);
  const caller = studioState.caller;
  const visualAssets = caller?.assets.filter((asset) => asset.type === "SUPPORTING_VISUAL") ?? [];
  const voiceProviderLabel = voiceProvider === "gemini" ? "Gemini Live" : voiceProvider === "elevenlabs" ? "ElevenLabs Agent" : "OpenAI Realtime";

  const refreshStudio = useCallback(async () => {
    const response = await fetch(`/api/shows/${showId}/studio-state`, { cache: "no-store" });
    if (response.ok) setStudioState(await response.json() as StudioState);
  }, [showId]);

  useEffect(() => {
    const source = new EventSource(url);
    const handleState = (event: MessageEvent) => {
      setSnapshot(JSON.parse(event.data) as BroadcastSnapshot);
      // A producer can append a caller from another browser while the host stays
      // live. Refresh the private queue panel whenever that broadcast update lands.
      void refreshStudio();
    };
    source.addEventListener("state", handleState);
    source.onerror = () => setMessage("Display sync reconnecting...");
    return () => {
      source.removeEventListener("state", handleState);
      source.close();
    };
  }, [refreshStudio, url]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    void sessionRef.current?.endSession();
  }, []);

  useEffect(() => {
    setLiveDirection({ ...neutralLiveDirection });
    directionAppliedRef.current = false;
  }, [caller?.id]);

  useEffect(() => {
    if (!sessionConnected || !sessionRef.current) return;
    const isNeutral = liveDirection.energy === 0 && liveDirection.pace === 0 && liveDirection.answerLength === 0;
    if (isNeutral && !directionAppliedRef.current) return;
    const timer = window.setTimeout(() => {
      void sessionRef.current?.updateInstructions(buildLiveDirectionInstructions(liveDirection))
        .then(() => {
          directionAppliedRef.current = true;
          setMessage("Live caller direction updated for the next reply.");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to update the live caller direction."));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [liveDirection, sessionConnected]);

  const persistTranscript = useCallback((entry: { speaker: "HOST" | "CALLER"; text: string }) => {
    setTranscript((entries) => [...entries, entry].slice(-24));
    void fetch(`/api/shows/${showId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  }, [showId]);

  const reportLevels = useCallback((next: typeof emptyLevels) => {
    setLevels(next);
    const now = performance.now();
    if (now - lastAudioLevelSent.current < 90) return;
    lastAudioLevelSent.current = now;
    void fetch(`/api/shows/${showId}/audio-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next.output, bands: next.outputBands }),
    });
  }, [showId]);

  const postControl = useCallback(async (action: StudioControlAction) => {
    const response = await fetch(`/api/shows/${showId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json() as BroadcastSnapshot & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Control action failed.");
    setSnapshot(data);
    await refreshStudio();
  }, [refreshStudio, showId]);

  const triggerVisual = useCallback(async (assetId: string | null) => {
    const response = await fetch(`/api/shows/${showId}/visual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const data = await response.json() as BroadcastSnapshot & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to update the visual.");
    setSnapshot(data);
    setMessage(assetId ? "Broadcast visual shown." : "Broadcast visual cleared.");
    await refreshStudio();
  }, [refreshStudio, showId]);

  const connectRealtime = useCallback(async (updateBroadcastState: boolean) => {
    if (!caller) throw new Error("Cue a caller before connecting a voice session.");
    setVoiceStatus(`Connecting to ${voiceProviderLabel}…`);
    const provider = voiceProvider === "gemini" ? new GeminiLiveVoiceProvider() : voiceProvider === "elevenlabs" ? new ElevenLabsAgentVoiceProvider() : new OpenAIWebRtcVoiceProvider();
    const session = await provider.createSession({
      showId,
      callerId: caller.id,
      instructions: "",
      voiceId: text(caller.performance.voiceId),
      inputDeviceId: inputDeviceId || undefined,
      onTranscript: persistTranscript,
      onLevels: reportLevels,
      onStatus: setVoiceStatus,
      onError: (error) => setMessage(error),
    });
    sessionRef.current = session;
    setSessionConnected(true);
    await session.setOutputVolume(volume);
    if (snapshot.broadcastState === "CALLER_ON_HOLD") {
      await session.muteOutput(true);
      setMuted(true);
    }
    const devices = await listMicrophones();
    setInputDevices(devices);
    if (!inputDeviceId && devices[0]) setInputDeviceId(devices[0].id);
    if (updateBroadcastState) await postControl("MOCK_CONNECT");
    setMessage(updateBroadcastState
      ? `${voiceProviderLabel} caller connected. The caller will open the conversation, then respond after each host turn.`
      : "Caller browser audio reconnected. Resume the call when you are ready to put them on air.");
  }, [caller, inputDeviceId, persistTranscript, postControl, reportLevels, showId, snapshot.broadcastState, triggerVisual, voiceProvider, voiceProviderLabel, volume]);

  const playMockCaller = useCallback(() => {
    if (!caller) return;
    if (!("speechSynthesis" in window)) {
      setMessage("Browser speech is unavailable here. Connect a live caller in Chrome or Edge instead.");
      return;
    }
    const opening = `${caller.name}: ${caller.openingSummary}`;
    const utterance = new SpeechSynthesisUtterance(opening);
    utterance.rate = 0.94;
    utterance.pitch = 1.04;
    utterance.onstart = () => setVoiceStatus("Mock caller speaking");
    utterance.onend = () => setVoiceStatus("Mock caller ready");
    utterance.onerror = () => setMessage("Mock browser speech could not start. Check that browser audio is not muted.");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setMessage("Playing an audible mock caller line. Choose Connect AI caller when you are ready for the live voice.");
  }, [caller]);

  const endBrowserAudio = useCallback(async () => {
    window.speechSynthesis?.cancel();
    await sessionRef.current?.endSession();
    sessionRef.current = null;
    setSessionConnected(false);
    directionAppliedRef.current = false;
    setVoiceStatus("No browser voice session");
    setLevels(emptyLevels);
    void fetch(`/api/shows/${showId}/audio-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: 0, bands: emptyLevels.outputBands }),
    });
    setMuted(false);
  }, [showId]);

  const control = useCallback(async (action: StudioControlAction) => {
    setBusy(true);
    try {
      if (action === "INTERRUPT_CALLER") await sessionRef.current?.interrupt();
      if (action === "MUTE_CALLER") {
        await sessionRef.current?.muteOutput(true);
        setMuted(true);
      }
      if (action === "UNMUTE_CALLER") {
        await sessionRef.current?.muteOutput(false);
        setMuted(false);
      }
      if (action === "HOLD_CALLER") {
        await sessionRef.current?.muteOutput(true);
        setMuted(true);
        window.speechSynthesis?.cancel();
      }
      if (action === "RESUME_CALLER") {
        await sessionRef.current?.muteOutput(false);
        setMuted(false);
      }
      if (action === "END_CALL") playSynthCue("hostHangup");
      if (action === "CALLER_HANGS_UP") playSynthCue("callerHangup");
      if (["END_CALL", "CALLER_HANGS_UP", "SKIP_CALLER", "EMERGENCY_STOP", "END_SHOW"].includes(action)) await endBrowserAudio();

      await postControl(action);
      if (["END_CALL", "CALLER_HANGS_UP"].includes(action)) {
        try {
          await postControl("CUE_NEXT");
          playSynthCue("incoming");
          setMessage(`${action === "CALLER_HANGS_UP" ? "Caller hung up" : "Call ended"}. The next caller is now coming up on the display — press Answer when you are ready to put them on air.`);
        } catch {
          setMessage("Call ended. There are no more callers in the queue.");
        }
      } else if (action === "ANSWER_CALL") {
        playSynthCue("connected");
        try {
          await connectRealtime(true);
        } catch (error) {
          setVoiceStatus("AI caller not connected");
          setMessage(error instanceof Error ? `${error.message} The caller is still waiting; use Connect AI caller to retry or Use mock caller to continue the run.` : "The caller is still waiting. Use Connect AI caller to retry or Use mock caller to continue the run.");
        }
      } else if (action === "MOCK_SPEAK") {
        playMockCaller();
      } else if (action === "HOLD_CALLER") {
        setVoiceStatus(sessionRef.current ? "Caller audio on hold" : "Mock caller on hold");
        setMessage("Caller is on hold. Press Resume caller to put them back on air.");
      } else if (action === "RESUME_CALLER") {
        setVoiceStatus(sessionRef.current ? "Realtime caller connected" : "Mock caller ready");
        setMessage(sessionRef.current ? "Caller is back on air." : "Caller is back on air. Connect AI caller for a live voice, or play the mock line to test your speakers.");
      } else {
        setMessage(`Executed ${action.replaceAll("_", " ")}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Control action failed.");
    } finally {
      setBusy(false);
    }
  }, [connectRealtime, endBrowserAudio, playMockCaller, postControl]);

  const connectAiCaller = useCallback(async () => {
    setBusy(true);
    try {
      await connectRealtime(snapshot.broadcastState === "CALLER_CONNECTING");
    } catch (error) {
      setVoiceStatus("No browser voice session");
      setMessage(error instanceof Error ? error.message : "Unable to reconnect browser voice.");
    } finally {
      setBusy(false);
    }
  }, [connectRealtime, snapshot.broadcastState]);

  const startMockCaller = useCallback(async () => {
    setBusy(true);
    try {
      await postControl("MOCK_CONNECT");
      setVoiceStatus("Mock caller speaking");
      playMockCaller();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start the mock caller.");
    } finally {
      setBusy(false);
    }
  }, [playMockCaller, postControl]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const controls: Record<string, StudioControlAction> = {
        " ": "INTERRUPT_CALLER",
        e: "END_CALL",
        m: muted ? "UNMUTE_CALLER" : "MUTE_CALLER",
        n: "CUE_NEXT",
        Escape: "EMERGENCY_STOP",
      };
      const action = controls[event.key];
      if (action) {
        event.preventDefault();
        void control(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [control, muted]);

  const changeInput = async (deviceId: string) => {
    setInputDeviceId(deviceId);
    try {
      await sessionRef.current?.switchInputDevice(deviceId);
      setMessage("Microphone switched.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to switch microphone.");
    }
  };

  const changeVolume = async (next: number) => {
    setVolume(next);
    await sessionRef.current?.setOutputVolume(next);
  };

  const replayQueue = useCallback(async () => {
    setBusy(true);
    try {
      await endBrowserAudio();
      const response = await fetch(`/api/shows/${showId}/reset`, { method: "POST" });
      const data = await response.json() as BroadcastSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to reset the running order.");
      setSnapshot(data);
      await refreshStudio();
      setMessage("All callers are queued again. Start the show whenever you are ready for another run-through.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset the running order.");
    } finally {
      setBusy(false);
    }
  }, [endBrowserAudio, refreshStudio, showId]);

  const playSound = async (effect: StudioState["soundEffects"][number]) => {
    let audio = soundRef.current.get(effect.id);
    if (!audio) {
      audio = new Audio(effect.url);
      soundRef.current.set(effect.id, audio);
    }
    audio.loop = effect.loop;
    audio.volume = effect.volume;
    audio.currentTime = 0;
    await audio.play();
    void fetch(`/api/shows/${showId}/sound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundEffectId: effect.id }),
    });
    setMessage(`Playing sound cue: ${effect.label}.`);
  };

  const stopSound = (effectId: string) => {
    const audio = soundRef.current.get(effectId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      const builtIn = {
        c: { cue: "cheer" as const, message: "Played optional cheer cue." },
        h: { cue: "horn" as const, message: "Played optional horn cue." },
        r: { cue: "rimshot" as const, message: "Played optional rimshot cue." },
        g: { cue: "callerHangup" as const, message: "Played caller hang-up cue." },
      }[key];
      if (builtIn) {
        event.preventDefault();
        playSynthCue(builtIn.cue);
        setMessage(builtIn.message);
        return;
      }
      const customEffect = studioState.soundEffects.find((effect) => effect.hotkey?.toLowerCase() === key);
      if (customEffect) {
        event.preventDefault();
        void playSound(customEffect);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playSound, studioState.soundEffects]);

  const broadcastState = snapshot.broadcastState;
  const showIsLive = studioState.showStatus === "LIVE";
  const hasQueuedCaller = studioState.queue.some((item) => item.status === "QUEUED");
  const canStart = ["DRAFT", "READY"].includes(studioState.showStatus) && broadcastState === "SHOW_IDLE";
  const canCueNext = showIsLive && hasQueuedCaller && ["SHOW_IDLE", "CALLER_ENDED", "SHOW_BREAK"].includes(broadcastState);
  const canAnswer = broadcastState === "CALLER_INCOMING";
  const callerIsLive = broadcastState === "CALLER_LIVE";
  const callerIsHeld = broadcastState === "CALLER_ON_HOLD";
  const callerCanEnd = ["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(broadcastState);
  const callerCanSkip = ["CALLER_INCOMING", "CALLER_CONNECTING"].includes(broadcastState);
  const canReplayQueue = !callerCanEnd
    && !hasQueuedCaller
    && studioState.queue.some((item) => ["COMPLETED", "SKIPPED", "FAILED"].includes(item.status))
    && ["SHOW_IDLE", "CALLER_ENDED", "SHOW_BREAK", "SHOW_ENDED"].includes(broadcastState);
  const canConnectAi = !sessionConnected && ["CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(broadcastState);
  const connectButtonLabel = `Connect ${voiceProvider === "gemini" ? "Gemini" : voiceProvider === "elevenlabs" ? "ElevenLabs" : "OpenAI"} caller`;
  const stateLabel = broadcastState.replaceAll("_", " ");
  const nextStep = canStart
    ? "Start the show to open the line."
    : canCueNext
      ? "Bring the first caller into the coming-up position."
    : canAnswer
        ? "This caller is coming up. Answer when you are ready to put them on air."
        : broadcastState === "CALLER_CONNECTING"
          ? `${connectButtonLabel}. This will ask for microphone permission.`
        : callerIsHeld
          ? sessionConnected ? "Caller is on hold. Resume caller to put them back on air." : `Caller is on hold and needs browser voice. ${connectButtonLabel}, then resume them.`
          : callerIsLive
            ? sessionConnected ? "Caller is live. Speak naturally, then pause for their reply." : `The caller is on air but browser voice is not connected. ${connectButtonLabel}, or use the mock line to test your speakers.`
              : canReplayQueue
                ? "All callers have finished. Queue them all again for another run."
                : "End the current call and the next caller will be prepared automatically.";
  const primaryAction = canStart
    ? { label: "Start show", run: () => void control("START_SHOW") }
    : canCueNext
      ? { label: "Bring in first caller", run: () => void control("CUE_NEXT") }
      : canAnswer
        ? { label: `Answer ${caller?.name ?? "caller"}`, run: () => void control("ANSWER_CALL") }
        : broadcastState === "CALLER_CONNECTING"
          ? { label: connectButtonLabel, run: () => void connectAiCaller() }
          : callerIsHeld
            ? !sessionConnected
              ? { label: connectButtonLabel, run: () => void connectAiCaller() }
              : { label: `Resume ${caller?.name ?? "caller"}`, run: () => void control("RESUME_CALLER") }
            : callerIsLive && !sessionConnected
              ? { label: connectButtonLabel, run: () => void connectAiCaller() }
              : canReplayQueue
                ? { label: "Run all callers again", run: () => void replayQueue() }
              : null;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]">
    <section className="space-y-5">
      <div className="panel panel-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Current caller</p>
            <h2 className="mt-1 text-2xl font-black text-white">{caller?.name ?? "No caller selected"}</h2>
            <p className="mt-1 text-sm text-slate-300">{caller ? `${caller.age ? `${caller.age} - ` : ""}${caller.location}${caller.occupation ? ` - ${caller.occupation}` : ""}` : "Cue the first queued caller after starting the show."}</p>
          </div>
          <span className={`status ${callerIsLive ? "animate-pulse bg-rose-700 text-white" : callerIsHeld ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-slate-200"}`}>{stateLabel}</span>
        </div>
        <p className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3 text-sm font-semibold text-cyan-50">Next step: {nextStep}</p>
        {caller && <>
          <div className="mt-5 grid gap-4 md:grid-cols-[150px_1fr]">
            <div className="grid aspect-square place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-violet-500 to-rose-500 text-5xl font-black text-slate-950">{caller.name.slice(0, 1)}</div>
            <div>
              <p className="text-xl font-bold text-white">{caller.issueHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{caller.openingSummary}</p>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div><p className="label">Private premise</p><p className="mt-1 text-slate-200">{text(caller.story.surfaceProblem)}</p></div>
                <div><p className="label">Story tension</p><p className="mt-1 text-slate-200">{text(caller.character.comicContradiction)}</p></div>
                <div><p className="label">Character objective</p><p className="mt-1 text-slate-200">{text(caller.character.centralWant)}</p></div>
                <div><p className="label">Concealing</p><p className="mt-1 text-slate-200">{text(caller.story.hiddenTruth)}</p></div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{textList(caller.hostSupport.suggestedQuestions).slice(0, 3).map((prompt) => <div key={prompt} className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-sm text-cyan-50">{prompt}</div>)}</div>
        </>}
      </div>

      <div className="panel panel-pad">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">Live controls</p>{primaryAction && <button type="button" disabled={busy} onClick={primaryAction.run} className="button-primary">{primaryAction.label}</button>}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {callerIsLive && sessionConnected && <><button type="button" disabled={busy} onClick={() => void control("INTERRUPT_CALLER")} className="button-secondary">Interrupt (Space)</button><button type="button" disabled={busy} onClick={() => void control(muted ? "UNMUTE_CALLER" : "MUTE_CALLER")} className="button-secondary">{muted ? "Unmute" : "Mute"} (M)</button><button type="button" disabled={busy} onClick={() => void control("HOLD_CALLER")} className="button-secondary">Put on hold</button></>}
          {callerIsLive && <button type="button" disabled={busy} onClick={() => void control("MOCK_SPEAK")} className="button-secondary">Test speaker with mock line</button>}
          {broadcastState === "CALLER_CONNECTING" && <button type="button" disabled={busy} onClick={() => void startMockCaller()} className="button-secondary">Use mock caller instead</button>}
          {callerCanEnd && <button type="button" disabled={busy} onClick={() => void control("END_CALL")} className="button-danger">End call (E)</button>}
          {callerIsLive && <button type="button" disabled={busy} onClick={() => void control("CALLER_HANGS_UP")} className="button-secondary">Caller hangs up</button>}
          {callerCanSkip && <button type="button" disabled={busy} onClick={() => void control("SKIP_CALLER")} className="button-secondary">Skip caller</button>}
          <button type="button" disabled={busy} onClick={() => void triggerVisual(null)} className="button-secondary">Clear visual</button>
          {showIsLive && <button type="button" disabled={busy} onClick={() => void control("EMERGENCY_STOP")} className="button-danger">Stop all audio (Esc)</button>}
        </div>
        {caller && sessionConnected && <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="label">Live caller direction</p><p className="mt-1 text-xs text-slate-400">Temporary nudges from the caller's authored baseline. Changes apply to the next reply.</p></div><button type="button" className="text-xs font-bold text-cyan-200 hover:text-white" onClick={() => setLiveDirection({ ...neutralLiveDirection })}>Reset</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {([
              ["energy", "Energy"],
              ["pace", "Pace"],
              ["answerLength", "Answer length"],
            ] as const).map(([key, label]) => <label key={key} className="rounded-lg bg-slate-950/70 p-2"><span className="flex items-center justify-between gap-2 text-xs"><b className="text-slate-200">{label}</b><span className="text-cyan-200">{directionLabels[key][liveDirection[key] + 2]}</span></span><input className="mt-2 w-full accent-cyan-300" type="range" min="-2" max="2" step="1" value={liveDirection[key]} onChange={(event) => setLiveDirection((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
          </div>
        </div>}
        {canConnectAi && <p className="mt-3 text-xs text-slate-400">The main action above creates a fresh, one-use connection for this caller. You never need to manage session credentials.</p>}
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 md:grid-cols-2">
          <div>
            <p className="label">Voice session</p>
            <p className="mt-1 text-sm text-cyan-200">{voiceStatus}</p>
            <label className="mt-3 block"><span className="label">Caller route</span><select className="field !mt-1" value={voiceProvider} onChange={(event) => setVoiceProvider(event.target.value as VoiceProviderId)} disabled={sessionConnected}><option value="openai">OpenAI Realtime 1.5 (default)</option><option value="gemini">Gemini Live (optional)</option><option value="elevenlabs">ElevenLabs Agent (optional)</option></select></label>
            <p className="mt-2 text-xs text-amber-200">Use headphones during live calls to prevent feedback. Live browser audio needs Chrome or Edge at <b>http://localhost:3000</b> or an HTTPS URL; HTTP on a LAN/IP address cannot use the microphone.</p>
            {voiceProvider === "openai" && <p className="mt-2 text-xs text-slate-400">Room noise will not automatically cut off the caller. Press <b>Space</b> or use <b>Interrupt</b> when you want to speak over them.</p>}
            {voiceProvider === "gemini" && <p className="mt-2 text-xs text-slate-400">Gemini ignores microphone activity while the caller is speaking, so incidental noise will not cut the answer short. Use Interrupt or Space for a deliberate barge-in. Host speech allows a short natural pause before Gemini replies.</p>}
            {voiceProvider === "elevenlabs" && <p className="mt-2 text-xs text-slate-400">ElevenLabs uses your configured Agent with a short-lived WebRTC token. Set its API key and Agent ID in <code>.env.local</code>; use the caller editor to optionally give an individual caller a voice ID.</p>}
          </div>
          <div className="space-y-2">
            <label className="block"><span className="label">Host microphone</span><select className="field !mt-1" value={inputDeviceId} onChange={(event) => void changeInput(event.target.value)} disabled={!sessionConnected}><option value="">Default microphone</option>{inputDevices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
            <label className="block"><span className="label">Caller volume</span><input className="mt-2 w-full accent-cyan-300" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => void changeVolume(Number(event.target.value))} /></label>
            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <div><span>Host mic</span><div className="mt-2 flex h-9 items-end gap-0.5 rounded bg-slate-900 px-1">{levels.inputBands.map((band, index) => <i key={index} className="min-w-0 flex-1 rounded-t bg-cyan-300 transition-[height] duration-75" style={{ height: `${Math.max(8, band * 100)}%`, opacity: 0.45 + band * 0.55 }} />)}</div></div>
              <div><span>Caller output · live signal</span><div className="mt-2 flex h-9 items-end gap-0.5 rounded bg-slate-900 px-1" aria-label="Live caller output level">{levels.outputBands.map((band, index) => <i key={index} className="min-w-0 flex-1 rounded-t bg-rose-400 transition-[height] duration-75" style={{ height: `${Math.max(8, band * 100)}%`, opacity: 0.45 + band * 0.55 }} />)}</div></div>
            </div>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-slate-950 p-3 text-sm text-slate-300" role="status">{message}</p>
      </div>
    </section>

    <aside className="space-y-5">
      <div className="panel panel-pad"><p className="eyebrow">Up next</p><QueueOrderEditor showId={showId} items={studioState.queue} onReordered={refreshStudio} refreshOnReorder={false} /></div>
      <div className="panel panel-pad">
        <div className="flex items-center justify-between gap-2"><p className="eyebrow">On-air tools</p><div className="flex rounded-lg bg-slate-950 p-1 text-xs font-bold"><button type="button" onClick={() => setMediaPane("visuals")} className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${mediaPane === "visuals" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`} title="Prepared visuals"><Images className="h-3.5 w-3.5" /> Visuals</button><button type="button" onClick={() => setMediaPane("soundboard")} className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${mediaPane === "soundboard" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`} title="Soundboard"><AudioLines className="h-3.5 w-3.5" /> Sounds</button></div></div>
        {mediaPane === "visuals"
          ? <><p className="mt-2 text-xs text-slate-400">Choose an image to send it to the broadcast display. Newly added caller visuals are available immediately.</p><div className="mt-3 grid grid-cols-2 gap-2">{visualAssets.length ? visualAssets.map((asset, index) => <button type="button" key={asset.id} onClick={() => void triggerVisual(asset.id)} className="aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-left text-xs text-slate-200 hover:border-cyan-400"><img className="h-16 w-full object-cover opacity-70" src={asset.url} alt="" /><span className="block p-2"><b className="text-cyan-300">{asset.manualHotkey ?? index + 1}</b><br />{asset.label}</span></button>) : <p className="text-sm text-slate-400">No caller visuals selected.</p>}</div></>
          : <><p className="mt-2 text-xs text-slate-400">Incoming, connection and host hang-up tones run automatically. These are optional host triggers.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { playSynthCue("cheer"); setMessage("Played optional cheer cue."); }} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">Cheer [C]</button><button type="button" onClick={() => { playSynthCue("horn"); setMessage("Played optional horn cue."); }} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">Horn [H]</button><button type="button" onClick={() => { playSynthCue("rimshot"); setMessage("Played optional rimshot cue."); }} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">Rimshot [R]</button><button type="button" onClick={() => { playSynthCue("callerHangup"); setMessage("Played caller hang-up cue."); }} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">Caller hangs up [G]</button>{studioState.soundEffects.map((effect) => <div key={effect.id} className="rounded-lg border border-slate-700 bg-slate-950 p-2"><button type="button" onClick={() => void playSound(effect)} className="w-full text-left text-xs font-bold text-slate-100 hover:text-cyan-200">Play {effect.label}{effect.hotkey ? ` [${effect.hotkey}]` : ""}</button><button type="button" onClick={() => stopSound(effect.id)} className="mt-2 text-[10px] font-bold uppercase text-slate-500">Stop</button></div>)}</div><p className="mt-3 text-xs text-slate-500">Add URL-based custom cues and a one-character hotkey from the show page.</p></>}
      </div>
      <div className="panel panel-pad"><p className="eyebrow">Live transcript</p><div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">{transcript.length ? transcript.map((entry, index) => <p key={`${entry.speaker}-${index}`}><b className="text-cyan-300">{entry.speaker === "HOST" ? "HOST" : "CALLER"}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-slate-400">Transcript events will appear and persist here during a Realtime call.</p>}</div></div>
      <div className="panel panel-pad"><p className="eyebrow">Event log</p><div className="mt-3 max-h-40 space-y-2 overflow-auto text-xs">{studioState.events.map((event, index) => <div className="flex justify-between gap-3 border-b border-slate-800 pb-2" key={`${event.timestamp}-${index}`}><span className="text-slate-200">{event.type.replaceAll("_", " ")}</span><time className="shrink-0 text-slate-500">{eventTime(event.timestamp)}</time></div>)}</div></div>
    </aside>
  </div>;
}
