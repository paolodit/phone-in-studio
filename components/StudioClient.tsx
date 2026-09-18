"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic2, PauseCircle, PhoneOff, Volume2, SlidersHorizontal } from "lucide-react";
import type { BroadcastSnapshot } from "@/lib/public-show";
import type { StudioControlAction } from "@/lib/schemas";
import type { StudioState } from "@/lib/studio-state";
import type { LiveVoiceSession } from "@/lib/voice/types";
import type { VoiceProviderId } from "@/lib/show-format";
import { ElevenLabsAgentVoiceProvider } from "@/lib/voice/elevenlabs-agent-provider";
import { FishAudioVoiceProvider } from "@/lib/voice/fish-audio-provider";
import { GeminiLiveVoiceProvider } from "@/lib/voice/gemini-live-provider";
import { listMicrophones, OpenAIWebRtcVoiceProvider } from "@/lib/voice/openai-webrtc-provider";
import { OpenAILiveVoiceProvider } from "@/lib/voice/openai-live-provider";
import { VoiceRouteOptions } from "@/components/VoiceRouteOptions";
import { resolveOpenAILiveVoice } from "@/lib/openai-live-voices";
import { QueueOrderEditor } from "@/components/QueueOrderEditor";
import { StudioRecorderPanel } from "@/components/StudioRecorderPanel";
import { StudioOnAirTools } from "@/components/StudioOnAirTools";
import { useVisualAutoplay } from "@/components/useVisualAutoplay";
import { HostTurnScheduler } from "@/lib/host-turn-scheduler";
import { playHostAudio } from "@/lib/host-audio";
import { builtInCues, musicTracks, clampAudioVolume, StudioAudioDeck, type BuiltInCueId, type DeckState } from "@/lib/studio-audio";
import { buildLiveDirectionInstructions, neutralLiveDirection, type LiveDirection } from "@/lib/live-direction";

const text = (value: unknown) => typeof value === "string" ? value : "-";
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const emptyLevels = { input: 0, output: 0, inputBands: Array.from({ length: 12 }, () => 0), outputBands: Array.from({ length: 12 }, () => 0) };
const directionLabels = {
  energy: ["Very calm", "Calmer", "Baseline", "Livelier", "Animated"],
  pace: ["Much slower", "Slower", "Baseline", "Faster", "Much faster"],
  answerLength: ["Very brief", "Shorter", "Baseline", "Fuller", "Longest"],
};

const eventTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "-" : `${date.toISOString().slice(11, 19)} UTC`;
};

export function StudioClient(props: Parameters<typeof StudioInstance>[0]) {
  return <StudioInstance key={props.showId} {...props} />;
}

function StudioInstance({
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
  const displayedSnapshot = useVisualAutoplay(snapshot);
  const [visualSettingsBusy, setVisualSettingsBusy] = useState(false);
  const [studioState, setStudioState] = useState(initialStudioState);
  const [message, setMessage] = useState("Your show is synced. The main action follows the current state of the line.");
  const [voiceStatus, setVoiceStatus] = useState("No browser voice session");
  const [inputDevices, setInputDevices] = useState<{ id: string; label: string }[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [levels, setLevels] = useState(emptyLevels);
  const [interruptionMode, setInterruptionMode] = useState<"guarded" | "manual">("guarded");
  const [callerSpeaking, setCallerSpeaking] = useState(false);
  const [replyLatency, setReplyLatency] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [recordingStopSignal, setRecordingStopSignal] = useState(0);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProviderId>(initialVoiceProvider);
  const [sessionConnected, setSessionConnected] = useState(false);
  const [liveDirection, setLiveDirection] = useState<LiveDirection>({ ...neutralLiveDirection });
  const [transcript, setTranscript] = useState<{ speaker: "HOST" | "CALLER"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [musicState, setMusicState] = useState<DeckState>({ status: "idle" });
  const [cueState, setCueState] = useState<DeckState>({ status: "idle" });
  const [musicVolume, setMusicVolume] = useState(initialStudioState.backgroundMusic?.volume ?? 0.18);
  const [musicEnabled, setMusicEnabled] = useState(initialStudioState.backgroundMusic?.enabled ?? false);
  const [musicTrackId, setMusicTrackId] = useState(initialStudioState.backgroundMusic?.trackId ?? "late-night-radio");
  const [cueVolume, setCueVolume] = useState(0.7);
  const [musicLoop, setMusicLoop] = useState(initialStudioState.backgroundMusic?.loop ?? true);
  const [audioPreferencesReady, setAudioPreferencesReady] = useState(false);
  const musicDeckRef = useRef<StudioAudioDeck | null>(null);
  const cueDeckRef = useRef<StudioAudioDeck | null>(null);
  const [aiHostPaused, setAiHostPaused] = useState(false);
  const [aiHostBusy, setAiHostBusy] = useState(false);
  const [autoRunActive, setAutoRunActive] = useState(false);
  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const connectionAbortRef = useRef<AbortController | null>(null);
  const hostTurnAbortRef = useRef<AbortController | null>(null);
  const hostAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoRunRef = useRef(false);
  const autoReplayRequestedRef = useRef(false);
  const autoTransitionRef = useRef(false);
  const hostSchedulerRef = useRef(new HostTurnScheduler());
  const autoVisualShownForCallerRef = useRef("");
  const hostTurnCountRef = useRef(0);
  const directionAppliedRef = useRef(false);
  const soundRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  useEffect(() => {
    const music = new StudioAudioDeck(setMusicState, 0.18);
    const cues = new StudioAudioDeck(setCueState, 0.7);
    musicDeckRef.current = music; cueDeckRef.current = cues;
    setMusicState({ status: "idle" }); setCueState({ status: "idle" });
    try {
      const saved = JSON.parse(localStorage.getItem(`phone-in:studio-audio:${showId}`) ?? "null");
      if (saved) {
        if (typeof saved.musicVolume === "number") setMusicVolume(clampAudioVolume(saved.musicVolume));
        if (typeof saved.cueVolume === "number") setCueVolume(clampAudioVolume(saved.cueVolume));
        if (typeof saved.musicLoop === "boolean") setMusicLoop(saved.musicLoop);
        if (typeof saved.musicEnabled === "boolean") setMusicEnabled(saved.musicEnabled);
        if (musicTracks.some((track) => track.id === saved.musicTrackId)) setMusicTrackId(saved.musicTrackId);
      }
    } catch { /* Playback remains usable without saved preferences. */ }
    setAudioPreferencesReady(true); cues.preload(builtInCues);
    return () => { music.dispose(); cues.dispose(); };
  }, [showId]);
  useEffect(() => {
    musicDeckRef.current?.setVolume(musicVolume); musicDeckRef.current?.setLoop(musicLoop); cueDeckRef.current?.setVolume(cueVolume);
    for (const effect of studioState.soundEffects) { const audio = soundRef.current.get(effect.id); if (audio) audio.volume = clampAudioVolume(effect.volume * cueVolume); }
    if (audioPreferencesReady) { try { localStorage.setItem(`phone-in:studio-audio:${showId}`, JSON.stringify({ musicVolume, cueVolume, musicLoop, musicEnabled, musicTrackId })); } catch { /* Optional preference storage. */ } }
  }, [musicVolume, cueVolume, musicLoop, musicEnabled, musicTrackId, audioPreferencesReady, showId, studioState.soundEffects]);
  const startDefaultMusic = useCallback(() => {
    if (!musicEnabled || !audioPreferencesReady || musicState.status !== "idle") return;
    const track = musicTracks.find((item) => item.id === musicTrackId);
    if (track) void musicDeckRef.current?.play(track);
  }, [musicEnabled, audioPreferencesReady, musicState.status, musicTrackId]);
  const stopMusic = useCallback(() => { setMusicEnabled(false); musicDeckRef.current?.stop(); }, []);
  const playCue = useCallback((id: BuiltInCueId) => { const cue = builtInCues.find((item) => item.id === id); if (cue) void cueDeckRef.current?.play(cue); }, []);
  const stopEffects = useCallback(() => { cueDeckRef.current?.stop(); soundRef.current.forEach((audio) => { audio.pause(); audio.currentTime = 0; }); }, []);
  useEffect(() => { if (snapshot.broadcastState === "SHOW_ENDED") { musicDeckRef.current?.stop(); stopEffects(); } }, [snapshot.broadcastState, stopEffects]);
  const lastAudioLevelSent = useRef(0);
  const lastMeterPaint = useRef(0);
  const audioReportInFlight = useRef(false);
  const audioChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`phone-in-audio:${showId}`);
    audioChannelRef.current = channel;
    return () => { audioChannelRef.current = null; channel.close(); };
  }, [showId]);
  const url = useMemo(() => `/api/shows/${showId}/events`, [showId]);
  const caller = studioState.caller;
  const callerTension = text(caller?.character.internalTension ?? caller?.character.comicContradiction);
  const callerWithheldDetail = text(caller?.story.hiddenTruth);
  const visualAssets = caller?.assets.filter((asset) => asset.type === "SUPPORTING_VISUAL") ?? [];
  const primaryAutoVisualId = visualAssets[0]?.id;
  const voiceProviderLabel = voiceProvider === "openai-live" ? "GPT-Live-1" : voiceProvider === "gemini"
    ? "Gemini Live"
    : voiceProvider === "elevenlabs"
      ? "ElevenLabs Agent"
      : voiceProvider === "fish"
        ? "Fish Audio"
        : "OpenAI Realtime";

  const refreshStudio = useCallback(async () => {
    const response = await fetch(`/api/shows/${showId}/studio-state`, { cache: "no-store" });
    if (response.status === 404) { window.location.replace("/shows"); return; }
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
    source.addEventListener("deleted", () => {
      source.close(); autoRunRef.current = false; connectionAbortRef.current?.abort(); hostTurnAbortRef.current?.abort();
      hostAudioRef.current?.pause(); musicDeckRef.current?.stop(); cueDeckRef.current?.stop();
      soundRef.current.forEach((audio) => audio.pause()); window.speechSynthesis?.cancel();
      void sessionRef.current?.endSession();
      window.location.replace("/shows");
    });
    source.onerror = () => { setMessage("Display sync reconnecting..."); void refreshStudio(); };
    return () => {
      source.removeEventListener("state", handleState);
      source.close();
    };
  }, [refreshStudio, url]);

  useEffect(() => () => {
    connectionAbortRef.current?.abort();
    hostTurnAbortRef.current?.abort();
    soundRef.current.forEach((audio) => audio.pause());
    window.speechSynthesis?.cancel();
    hostAudioRef.current?.pause();
    hostSchedulerRef.current.cancel();
    void sessionRef.current?.endSession();
  }, []);

  useEffect(() => { autoRunRef.current = autoRunActive; }, [autoRunActive]);
  useEffect(() => {
    if (!sessionConnected) return;
    void sessionRef.current?.muteInput(autoRunActive || aiHostBusy || snapshot.broadcastState === "CALLER_ON_HOLD").catch(() => undefined);
  }, [autoRunActive, aiHostBusy, sessionConnected, snapshot.broadcastState]);

  useEffect(() => {
    setLiveDirection({ ...neutralLiveDirection });
    directionAppliedRef.current = false;
    hostTurnCountRef.current = 0;
    hostSchedulerRef.current.reset();
    autoVisualShownForCallerRef.current = "";
    setTranscript([]);
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
    }).catch(() => setMessage("Transcript could not be saved. Live audio continues; check your connection."));
  }, [showId]);

  const reportLevels = useCallback((next: typeof emptyLevels) => {
    const now = performance.now();
    // UI meters do not need to rerender the entire studio at the audio frame rate.
    if (now - lastMeterPaint.current >= 100) { setLevels(next); lastMeterPaint.current = now; }
    audioChannelRef.current?.postMessage({ level: next.output, bands: next.outputBands });
    // Remote OBS/producer windows use SSE. Never build up overlapping HTTP posts.
    if (audioReportInFlight.current || now - lastAudioLevelSent.current < 125) return;
    audioReportInFlight.current = true;
    lastAudioLevelSent.current = now;
    void fetch(`/api/shows/${showId}/audio-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next.output, bands: next.outputBands }),
      signal: AbortSignal.timeout(2_000),
    }).catch(() => undefined).finally(() => { audioReportInFlight.current = false; });
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

  const showVisual = useCallback(async (assetId: string | null) => {
    try { await triggerVisual(assetId); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update the visual."); }
  }, [triggerVisual]);

  const saveVisualAutoplay = useCallback(async (enabled: boolean, intervalSeconds: number) => {
    setVisualSettingsBusy(true);
    try {
      const response = await fetch(`/api/shows/${showId}/visual-autoplay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, intervalSeconds }) });
      const result = await response.json() as BroadcastSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save image autoplay.");
      setSnapshot(result);
      await refreshStudio();
      setMessage(enabled ? `Image autoplay enabled for all callers · ${intervalSeconds} seconds per image.` : "Image autoplay paused. The current image stays on air.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save image autoplay."); }
    finally { setVisualSettingsBusy(false); }
  }, [showId, refreshStudio]);

  const connectRealtime = useCallback(async (updateBroadcastState: boolean) => {
    if (!caller) throw new Error("Cue a caller before connecting a voice session.");
    connectionAbortRef.current?.abort();
    const connectionAbort = new AbortController();
    connectionAbortRef.current = connectionAbort;
    await sessionRef.current?.endSession();
    sessionRef.current = null;
    setSessionConnected(false);
    setReplyLatency(null);
    setCallerSpeaking(false);
    setVoiceStatus(`Connecting to ${voiceProviderLabel}…`);
    const provider = voiceProvider === "openai-live" ? new OpenAILiveVoiceProvider() : voiceProvider === "gemini"
      ? new GeminiLiveVoiceProvider()
      : voiceProvider === "elevenlabs"
        ? new ElevenLabsAgentVoiceProvider()
        : voiceProvider === "fish"
          ? new FishAudioVoiceProvider()
          : new OpenAIWebRtcVoiceProvider();
    const session = await provider.createSession({
      showId,
      callerId: caller.id,
      signal: connectionAbort.signal,
      instructions: "",
      voiceId: text(caller.performance.voiceId),
      inputDeviceId: inputDeviceId || undefined,
      onTranscript: persistTranscript,
      onLevels: reportLevels,
      onStatus: setVoiceStatus,
      interruptionMode,
      onPlaybackChange: setCallerSpeaking,
      onReplyLatency: setReplyLatency,
      onDisconnected: () => { setSessionConnected(false); setCallerSpeaking(false); autoRunRef.current = false; setAutoRunActive(false); setAiHostPaused(true); hostTurnAbortRef.current?.abort(); },
      onError: (error) => setMessage(error),
    });
    if (connectionAbort.signal.aborted) { await session.endSession(); throw new DOMException("Caller connection cancelled", "AbortError"); }
    sessionRef.current = session;
    setSessionConnected(true);
    if (autoRunRef.current) await session.muteInput(true);
    await session.setOutputVolume(volume);
    if (snapshot.broadcastState === "CALLER_ON_HOLD") {
      await session.muteInput(true);
      await session.muteOutput(true);
      setMuted(true);
    }
    const devices = await listMicrophones();
    setInputDevices(devices);
    if (!inputDeviceId && devices[0]) setInputDeviceId(devices[0].id);
    if (updateBroadcastState) await postControl("MOCK_CONNECT");
    setMessage(updateBroadcastState
      ? voiceProvider === "openai-live" ? "GPT-Live caller connected. The caller will open naturally and can listen while speaking." : `${voiceProviderLabel} caller connected. The caller will open the conversation, then respond after each host turn.`
      : "Caller browser audio reconnected. Resume the call when you are ready to put them on air.");
  }, [caller, inputDeviceId, interruptionMode, persistTranscript, postControl, reportLevels, showId, snapshot.broadcastState, voiceProvider, voiceProviderLabel, volume]);

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
    connectionAbortRef.current?.abort();
    hostTurnAbortRef.current?.abort();
    hostAudioRef.current?.pause();
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
    }).catch(() => undefined);
    setMuted(false);
    setCallerSpeaking(false);
    audioChannelRef.current?.postMessage({ level: 0, bands: emptyLevels.outputBands });
  }, [showId]);

  const control = useCallback(async (action: StudioControlAction) => {
    setBusy(true);
    try {
      if (["START_SHOW", "ANSWER_CALL"].includes(action)) startDefaultMusic();
      if (["EMERGENCY_STOP", "END_SHOW"].includes(action)) {
        setRecordingStopSignal((value) => value + 1);
        autoRunRef.current = false;
        setAutoRunActive(false);
        hostAudioRef.current?.pause();
        soundRef.current.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
        cueDeckRef.current?.stop();
        musicDeckRef.current?.stop();
        window.speechSynthesis?.cancel();
        hostSchedulerRef.current.cancel();
      }
      if (action === "INTERRUPT_CALLER") {
        hostTurnAbortRef.current?.abort();
        hostAudioRef.current?.pause();
        autoRunRef.current = false;
        setAutoRunActive(false);
        setAiHostPaused(true);
        hostSchedulerRef.current.cancel();
        await sessionRef.current?.muteInput(false);
        await sessionRef.current?.interrupt();
      }
      if (action === "MUTE_CALLER") {
        await sessionRef.current?.muteOutput(true);
        setMuted(true);
      }
      if (action === "UNMUTE_CALLER") {
        await sessionRef.current?.muteOutput(false);
        setMuted(false);
      }
      if (action === "HOLD_CALLER") {
        hostTurnAbortRef.current?.abort();
        autoRunRef.current = false;
        setAutoRunActive(false);
        hostAudioRef.current?.pause();
        await sessionRef.current?.muteInput(true);
        await sessionRef.current?.muteOutput(true);
        setMuted(true);
        window.speechSynthesis?.cancel();
      }
      if (action === "RESUME_CALLER") {
        await sessionRef.current?.muteInput(false);
        await sessionRef.current?.muteOutput(false);
        setMuted(false);
      }
      if (action === "END_CALL") playCue("hostHangup");
      if (action === "CALLER_HANGS_UP") playCue("callerHangup");
      if (["END_CALL", "CALLER_HANGS_UP", "SKIP_CALLER", "EMERGENCY_STOP", "END_SHOW"].includes(action)) await endBrowserAudio();

      await postControl(action);
      if (["END_CALL", "CALLER_HANGS_UP"].includes(action)) {
        try {
          await postControl("CUE_NEXT");
          playCue("incoming");
          setMessage(`${action === "CALLER_HANGS_UP" ? "Caller hung up" : "Call ended"}. The next caller is now coming up on the display — press Answer when you are ready to put them on air.`);
        } catch {
          setMessage("Call ended. There are no more callers in the queue.");
        }
      } else if (action === "ANSWER_CALL") {
        playCue("connected");
        try {
          await connectRealtime(true);
        } catch (error) {
          autoRunRef.current = false;
          setAutoRunActive(false);
          setAiHostPaused(true);
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
      if (autoRunRef.current) { autoRunRef.current = false; setAutoRunActive(false); setAiHostPaused(true); }
    } finally {
      setBusy(false);
    }
  }, [connectRealtime, endBrowserAudio, playMockCaller, playCue, postControl, startDefaultMusic]);

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

  const runAiHostTurn = useCallback(async (intent: "respond" | "close" = "respond") => {
    const profile = studioState.aiHost?.profile;
    if (!profile || !caller || !sessionRef.current) {
      setMessage("Connect the caller before asking the AI Host to take a turn.");
      return false;
    }
    if (hostTurnAbortRef.current) return false;
    const abort = new AbortController();
    hostTurnAbortRef.current = abort;
    const activeSession = sessionRef.current;
    setAiHostBusy(true);
    setAiHostPaused(false);
    try {
      await activeSession.muteInput(true);
      await activeSession.interrupt();
      setVoiceStatus(`${profile.name} is preparing a response…`);
      const response = await fetch("/api/ai-host/respond", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showId, callerId: caller.id, transcript, intent }) });
      const result = await response.json() as { text?: string; profileId?: string; error?: string };
      if (!response.ok || !result.text || !result.profileId) throw new Error(result.error ?? "The AI Host could not prepare its next line.");
      const speech = await fetch("/api/ai-host/speech", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: result.profileId, text: result.text }) });
      if (!speech.ok) throw new Error((await speech.json() as { error?: string }).error ?? "The AI Host voice could not play.");
      const blob = await speech.blob();
      abort.signal.throwIfAborted();
      setVoiceStatus(`${profile.name} speaking`);
      await playHostAudio(blob, abort.signal, (audio) => { hostAudioRef.current = audio; });
      abort.signal.throwIfAborted();
      if (sessionRef.current !== activeSession) return false;
      persistTranscript({ speaker: "HOST", text: result.text });
      await activeSession.muteInput(autoRunRef.current);
      if (intent === "respond") {
        hostTurnCountRef.current += 1;
        await activeSession.sendHostText(result.text);
        setVoiceStatus("Waiting for caller reply");
        setMessage(`${profile.name} completed the host turn. The caller now has the exact spoken line as its prompt.`);
      } else {
        setVoiceStatus("Closing the call");
        setMessage(`${profile.name} closed the call. Preparing the next caller.`);
      }
      return true;
    } catch (error) {
      if (abort.signal.aborted) return false;
      await sessionRef.current?.muteInput(false).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "The AI Host turn failed.");
      setVoiceStatus("AI Host paused — human host can take over");
      setAiHostPaused(true);
      autoRunRef.current = false;
      setAutoRunActive(false);
      return false;
    } finally {
      if (hostTurnAbortRef.current === abort) { hostTurnAbortRef.current = null; setAiHostBusy(false); }
    }
  }, [caller, persistTranscript, showId, studioState.aiHost?.profile, transcript]);

  const takeOverFromAi = useCallback(() => {
    hostTurnAbortRef.current?.abort();
    autoRunRef.current = false;
    autoReplayRequestedRef.current = false;
    setAutoRunActive(false);
    hostAudioRef.current?.pause();
    hostSchedulerRef.current.cancel();
    void sessionRef.current?.muteInput(false);
    setAiHostPaused(true);
    setMessage("AI Host paused. Continue through the host microphone whenever you are ready.");
  }, []);

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
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.key !== "Escape" && event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, summary, [contenteditable=true]"))) return;
      const controls: Record<string, StudioControlAction> = {
        " ": "INTERRUPT_CALLER",
        e: "END_CALL",
        m: muted ? "UNMUTE_CALLER" : "MUTE_CALLER",
        n: "CUE_NEXT",
        Escape: "EMERGENCY_STOP",
      };
      const action = controls[event.key];
      const state = snapshot.broadcastState;
      const allowed = action === "EMERGENCY_STOP"
        || (action === "INTERRUPT_CALLER" || action === "MUTE_CALLER" || action === "UNMUTE_CALLER") && state === "CALLER_LIVE" && sessionConnected
        || action === "END_CALL" && ["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(state)
        || action === "CUE_NEXT" && ["SHOW_IDLE", "CALLER_ENDED", "SHOW_BREAK"].includes(state);
      if (action && allowed && (!busy || action === "EMERGENCY_STOP")) {
        event.preventDefault();
        void control(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [control, muted, snapshot.broadcastState, sessionConnected, busy]);

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
    audio.volume = clampAudioVolume(effect.volume * cueVolume);
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setMessage(`Could not play ${effect.label}. Check its URL and browser sound permissions.`); return; }
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
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, summary, [contenteditable=true]"))) return;
      const key = event.key.toLowerCase();
      const builtIn = {
        c: { cue: "cheer" as const, message: "Played optional cheer cue." },
        h: { cue: "horn" as const, message: "Played optional horn cue." },
        r: { cue: "rimshot" as const, message: "Played optional rimshot cue." },
        g: { cue: "callerHangup" as const, message: "Played caller hang-up cue." },
      }[key];
      if (builtIn) {
        event.preventDefault();
        playCue(builtIn.cue);
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
  }, [playSound, playCue, studioState.soundEffects]);

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
  const connectButtonLabel = `Connect ${voiceProvider === "openai-live" ? "GPT-Live" : voiceProvider === "gemini" ? "Gemini" : voiceProvider === "elevenlabs" ? "ElevenLabs" : voiceProvider === "fish" ? "Fish" : "OpenAI"} caller`;
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

  useEffect(() => {
    if (!autoRunActive || autoTransitionRef.current || busy || aiHostBusy) return;
    const hasActiveCaller = ["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(broadcastState);
    const runTransition = async () => {
      autoTransitionRef.current = true;
      try {
        if (canReplayQueue && autoReplayRequestedRef.current) {
          autoReplayRequestedRef.current = false;
          await replayQueue();
        } else if (canStart && hasQueuedCaller) {
          await control("START_SHOW");
        } else if (canCueNext) {
          await control("CUE_NEXT");
        } else if (broadcastState === "CALLER_CONNECTING" && !sessionConnected) {
          await connectRealtime(true);
        } else if (callerIsLive && !sessionConnected) {
          await connectRealtime(false);
        } else if (callerIsHeld) {
          if (!sessionConnected) await connectRealtime(false);
          if (autoRunRef.current) await control("RESUME_CALLER");
        } else if (canAnswer) {
          setMessage(`Auto-run is bringing ${caller?.name ?? "the caller"} on air…`);
          await new Promise((resolve) => window.setTimeout(resolve, studioState.aiHost?.betweenCallsSeconds ? studioState.aiHost.betweenCallsSeconds * 1_000 : 3_000));
          if (autoRunRef.current) await control("ANSWER_CALL");
        } else if (showIsLive && !hasActiveCaller && !hasQueuedCaller) {
          await control("END_SHOW");
          autoRunRef.current = false;
          setAutoRunActive(false);
          setMessage("Auto-run completed the running order and ended the show.");
        }
      } catch (error) {
        autoRunRef.current = false;
        setAutoRunActive(false);
        setAiHostPaused(true);
        setMessage(error instanceof Error ? `${error.message} Auto-run paused for the human host.` : "Auto-run paused for the human host.");
      } finally {
        autoTransitionRef.current = false;
      }
    };
    void runTransition();
  }, [aiHostBusy, autoRunActive, broadcastState, busy, caller?.name, callerIsHeld, callerIsLive, canAnswer, canCueNext, canReplayQueue, canStart, connectRealtime, control, hasQueuedCaller, replayQueue, sessionConnected, showIsLive, studioState.aiHost?.betweenCallsSeconds]);

  useEffect(() => {
    const lastEntry = transcript.at(-1);
    if (!autoRunActive || aiHostBusy || busy || callerSpeaking || !callerIsLive || !sessionConnected || lastEntry?.speaker !== "CALLER") { hostSchedulerRef.current.cancel(); return; }
    const callerTurnNumber = transcript.filter((entry) => entry.speaker === "CALLER").length;
    const turnKey = `${caller?.id ?? "none"}:${callerTurnNumber}:${lastEntry.text}`;
    if (!studioState.visualAutoplay?.enabled && studioState.aiHost?.visualPolicy === "AUTO_SHOW" && primaryAutoVisualId && autoVisualShownForCallerRef.current !== caller?.id) {
      autoVisualShownForCallerRef.current = caller?.id ?? "";
      void triggerVisual(primaryAutoVisualId).catch((error: unknown) => {
        setMessage(error instanceof Error ? `${error.message} The call is continuing with the caller portrait.` : "The topic visual could not be shown. The call is continuing with the caller portrait.");
      });
    }
    hostSchedulerRef.current.schedule(turnKey, () => {
      void (async () => {
        if (!autoRunRef.current) return;
        const shouldClose = hostTurnCountRef.current >= (studioState.aiHost?.maxTurnsPerCaller ?? 4);
        const completed = await runAiHostTurn(shouldClose ? "close" : "respond");
        if (completed && shouldClose && autoRunRef.current) await control("END_CALL");
      })();
    });
  }, [aiHostBusy, autoRunActive, busy, callerSpeaking, caller?.id, callerIsLive, control, primaryAutoVisualId, runAiHostTurn, sessionConnected, studioState.aiHost?.maxTurnsPerCaller, studioState.aiHost?.visualPolicy, studioState.visualAutoplay?.enabled, transcript, triggerVisual]);

  useEffect(() => {
    if (autoRunActive && (!studioState.aiHost?.enabled || studioState.aiHost.mode !== "AI_AUTONOMOUS")) takeOverFromAi();
  }, [autoRunActive, studioState.aiHost?.enabled, studioState.aiHost?.mode, takeOverFromAi]);

  return <div className="space-y-4">
    <section className="live-transport" aria-label="Live controls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${callerIsLive ? "bg-rose-400" : callerIsHeld ? "bg-amber-300" : "bg-cyan-300"}`} /><p className="eyebrow">{stateLabel}</p><span className="text-xs text-slate-400">{sessionConnected ? voiceProviderLabel : "Audio not connected"}</span></div><p className="mt-1 text-sm font-bold text-white">{caller?.name ?? "Your live line"} <span className="font-normal text-slate-400">· {callerSpeaking ? "Speaking" : nextStep}</span></p></div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction && <button type="button" disabled={busy} onClick={primaryAction.run} className="button-primary">{primaryAction.label}</button>}
          {callerIsLive && sessionConnected && <><button type="button" disabled={busy} onClick={() => void control("INTERRUPT_CALLER")} className="button-primary">Take the floor <kbd className="shortcut-key">Space</kbd></button><button type="button" disabled={busy} aria-pressed={muted} onClick={() => void control(muted ? "UNMUTE_CALLER" : "MUTE_CALLER")} className="button-secondary"><Volume2 className="h-4 w-4" />{muted ? "Unmute" : "Mute"}</button><button type="button" disabled={busy} onClick={() => void control("HOLD_CALLER")} className="button-secondary"><PauseCircle className="h-4 w-4" />Hold</button></>}
          {callerCanEnd && <button type="button" disabled={busy} onClick={() => void control("END_CALL")} className="button-danger"><PhoneOff className="h-4 w-4" />End call</button>}
          {showIsLive && <button type="button" onClick={() => void control("EMERGENCY_STOP")} className="button-danger" title="Immediately stop all local audio (Escape)">Stop all <kbd className="shortcut-key">Esc</kbd></button>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-xs"><p role="status" className="min-w-0 text-slate-300">{message}</p>{replyLatency !== null && <span className="shrink-0 text-cyan-200" title="Last semantic speech endpoint to caller stream start; excludes browser playout and end-of-turn detection">Last reply · {(replyLatency / 1000).toFixed(2)}s</span>}</div>
      {sessionConnected && <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-white/5 pt-2">
        {[["Host mic", levels.inputBands], ["Caller", levels.outputBands]] .map(([label, bands]) => <div key={label as string} className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase text-slate-400">{label as string}</span><span className="flex h-4 w-20 items-end gap-0.5" aria-label={`${label} level`}>{(bands as number[]).map((band, index) => <i key={index} className="flex-1 rounded-sm bg-cyan-300" style={{ height: `${Math.max(8, band * 100)}%` }} />)}</span></div>)}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">Caller volume<input className="w-28 accent-cyan-300" type="range" min="0" max="1" step=".05" value={volume} onChange={(event) => void changeVolume(Number(event.target.value))} /></label>
      </div>}
    </section>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.85fr)]">
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

        {caller && <>
          <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-4 sm:grid-cols-[100px_minmax(0,1fr)]">
            <div className="aspect-square overflow-hidden rounded-xl bg-slate-800">{snapshot.caller?.portraitUrl ? <img src={snapshot.caller.portraitUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl font-black text-cyan-200">{caller.name.slice(0, 1)}</div>}</div>
            <div>
              <p className="text-xl font-bold text-white">{caller.issueHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{caller.openingSummary}</p>
              <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-cyan-200">Private caller briefing</summary><div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div><p className="label">Reason for calling</p><p className="mt-1 text-slate-200">{text(caller.story.surfaceProblem)}</p></div>
                <div><p className="label">Desired outcome</p><p className="mt-1 text-slate-200">{text(caller.character.centralWant)}</p></div>
                {callerTension !== "-" && callerTension.trim() && <div><p className="label">Internal tension</p><p className="mt-1 text-slate-200">{callerTension}</p></div>}
                {callerWithheldDetail !== "-" && callerWithheldDetail.trim() && <div><p className="label">Withheld detail</p><p className="mt-1 text-slate-200">{callerWithheldDetail}</p></div>}
              </div></details>
            </div>
          </div>
          <div className="mt-4 grid gap-2">{textList(caller.hostSupport.suggestedQuestions).slice(0, 3).map((prompt) => <div key={prompt} className="rounded-lg border-l-2 border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-sm text-cyan-50">{prompt}</div>)}</div>
        </>}
      </div>

      <div className="panel panel-pad">
        <p className="eyebrow">Voice & direction</p>
        {studioState.aiHost?.available && (!studioState.aiHost.enabled || studioState.aiHost.mode === "HUMAN") && <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-300/5 p-4"><p className="text-sm font-bold text-white">AI presenter is available</p><p className="mt-1 text-xs leading-5 text-slate-400">This show is currently human-hosted. Choose a presenter and an AI hosting mode to use it here.</p><Link className="button-secondary mt-3" href={`/shows/${showId}?section=options#show-options`}><Bot className="h-4 w-4" />Set up AI Host</Link></div>}
        {studioState.aiHost?.enabled && studioState.aiHost.mode !== "HUMAN" && studioState.aiHost.profile && <div className="mt-4 rounded-xl border border-violet-300/25 bg-violet-300/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Bot className="h-5 w-5 text-violet-200" /><div><p className="label">{studioState.aiHost.mode === "AI_AUTONOMOUS" ? "AI Host · auto-run" : "Supervised AI Host"}</p><p className="mt-1 text-sm font-bold text-white">{studioState.aiHost.profile.name} <span className="font-normal text-slate-400">· {studioState.aiHost.profile.stylePreset}</span></p></div></div><span className={`status ${autoRunActive ? "bg-emerald-300/10 text-emerald-100" : aiHostPaused ? "bg-amber-300/10 text-amber-100" : "bg-violet-300/10 text-violet-100"}`}>{autoRunActive ? "AUTO-RUN ACTIVE" : aiHostPaused ? "HUMAN TAKEOVER" : "READY"}</span></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{studioState.aiHost.mode === "AI_AUTONOMOUS" ? `Auto-run answers queued callers, responds after each completed caller turn, closes after ${studioState.aiHost.maxTurnsPerCaller} presenter turns and waits ${studioState.aiHost.betweenCallsSeconds} seconds before the next call. ${studioState.aiHost.visualPolicy === "AUTO_SHOW" ? "The primary credited topic image appears after the caller opens." : studioState.aiHost.visualPolicy === "PREPARE" ? "Prepared topic images remain under manual host control." : "The output stays on the caller portrait."} It never arms itself on page load.` : "Each press creates one short presenter response, speaks it, then passes the exact line to the caller without feeding speaker audio back through the microphone."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="button-secondary" href={`/settings/modules/ai-host?profile=${studioState.aiHost.profile.id}`}>Test presenter privately</Link>
            {studioState.aiHost.mode === "AI_AUTONOMOUS" && <button type="button" className={autoRunActive ? "button-secondary" : "button-primary"} disabled={aiHostBusy || busy || (!hasQueuedCaller && !callerCanEnd && !canReplayQueue)} onClick={() => { if (autoRunActive) { takeOverFromAi(); } else { startDefaultMusic(); setAiHostPaused(false); autoReplayRequestedRef.current = canReplayQueue; autoRunRef.current = true; setAutoRunActive(true); setMessage("AI Host auto-run armed. Queue and call transitions remain visible and Emergency Stop stays available."); } }}><Bot className="h-4 w-4" /> {autoRunActive ? "Pause auto-run" : "Start auto-run"}</button>}
            <button type="button" className={studioState.aiHost.mode === "AI_AUTONOMOUS" ? "button-secondary" : "button-primary"} disabled={!callerIsLive || !sessionConnected || aiHostBusy || busy || autoRunActive} onClick={() => void runAiHostTurn()}><Bot className="h-4 w-4" /> {aiHostBusy ? "Preparing host turn…" : "AI host: one turn"}</button>
            <button type="button" className="button-secondary" onClick={takeOverFromAi}><Mic2 className="h-4 w-4" /> Take over</button>
            <button type="button" className="button-secondary" disabled={aiHostBusy || aiHostPaused || autoRunActive} onClick={() => setAiHostPaused(true)}><PauseCircle className="h-4 w-4" /> Pause AI host</button>
          </div>
          {(!callerIsLive || !sessionConnected) && <p className="mt-3 text-xs text-violet-200">For one-turn hosting, answer and connect a caller using the main control above first. Auto-run can bring queued callers on air for you.</p>}
          {studioState.aiHost.configured === false && <p role="alert" className="mt-3 text-xs text-amber-200">AI Host needs OPENAI_API_KEY on the server. Add it and restart before starting a presenter.</p>}
        </div>}
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
        <details className="mt-3 rounded-xl border border-slate-700/60 bg-slate-950/50 p-3" open={!sessionConnected}><summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-200"><SlidersHorizontal className="h-4 w-4 text-cyan-300" />Audio setup <span className="ml-auto text-xs font-normal text-slate-400">{voiceStatus}</span></summary><div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="label">Voice session</p>
            <p className="mt-1 text-sm text-cyan-200">{voiceStatus}</p>
            <label className="mt-3 block"><span className="label">Caller route</span><select className="field !mt-1" value={voiceProvider} onChange={(event) => setVoiceProvider(event.target.value as VoiceProviderId)} disabled={sessionConnected || busy}><VoiceRouteOptions /></select></label>
            {voiceProvider === "openai-live" && <p className="mt-2 text-xs leading-5 text-slate-400">GPT-Live listens while speaking. Brief acknowledgements should not take the floor; say a clear interruption or use Space. {caller && <>Voice: <b className="text-cyan-200">{resolveOpenAILiveVoice(caller.performance)}</b>. Cast another voice in the caller editor or audition it in a private soundcheck. </>}Connected time is billed, including silence and hold; End call releases the session.</p>}
            {voiceProvider === "fish" && <p className="mt-2 text-xs leading-5 text-slate-400">Fish is a voice-quality comparison route, not a duplex conversational model. It waits for a complete host sentence, transcribes it, prepares the caller reply, then renders Fish speech. Use <b>Interrupt</b> to stop playback deliberately.</p>}
            <p className="mt-2 text-xs text-amber-200">Use headphones to avoid feedback. Chrome / Edge on localhost or HTTPS is required for microphone access.</p>
            {voiceProvider === "openai" && <label className="mt-3 block"><span className="label">Interruption style</span><select className="field" value={interruptionMode} onChange={(event) => { const mode = event.target.value as "guarded" | "manual"; setInterruptionMode(mode); sessionRef.current?.setInterruptionMode?.(mode); }}><option value="guarded">Guarded · meaningful words take the floor</option><option value="manual">Manual · Space to interrupt</option></select><span className="mt-2 block text-xs leading-5 text-slate-400">Guarded mode ignores short overlapping “uh-huhs” and acknowledgements. A clear phrase or “wait” interrupts. English transcript-based; Space always works.</span></label>}
            {voiceProvider === "gemini" && <p className="mt-2 text-xs text-slate-400">Gemini closes the microphone stream while caller audio is playing, with a 100 ms acoustic tail, so room noise will not cut the answer short. Use Interrupt or Space for a deliberate barge-in. Host speech allows a natural pause before Gemini replies.</p>}
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
        </details>
        <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold">More controls & speaker test</summary><div className="mt-3 flex flex-wrap gap-2">{callerIsLive && <button type="button" disabled={busy} onClick={() => void control("MOCK_SPEAK")} className="button-secondary">Test speaker with mock line</button>}{broadcastState === "CALLER_CONNECTING" && <button type="button" disabled={busy} onClick={() => void startMockCaller()} className="button-secondary">Use mock caller</button>}{callerCanSkip && <button type="button" disabled={busy} onClick={() => void control("SKIP_CALLER")} className="button-secondary">Skip caller</button>}{callerIsLive && <button type="button" disabled={busy} onClick={() => void control("CALLER_HANGS_UP")} className="button-secondary">Caller hangs up</button>}</div></details>
      </div>
    </section>

    <aside className="space-y-5">
      <div className="panel panel-pad"><div className="flex items-center justify-between gap-3"><p className="eyebrow">Up next</p><Link className="text-xs font-bold text-cyan-200" href={`/callers?show=${showId}`}>+ Add callers</Link></div><QueueOrderEditor showId={showId} items={studioState.queue} onReordered={refreshStudio} refreshOnReorder={false} /></div>
      <StudioRecorderPanel showId={showId} title={snapshot.title} callerName={caller?.name} inputDeviceId={inputDeviceId || undefined} transcript={transcript} stopSignal={recordingStopSignal} showEnded={broadcastState === "SHOW_ENDED"} />
      <StudioOnAirTools visuals={visualAssets} activeVisualUrl={displayedSnapshot.caller?.visual?.url} onVisual={(id) => void showVisual(id)} autoplay={studioState.visualAutoplay ?? { enabled: false, intervalSeconds: 10 }} autoplayBusy={visualSettingsBusy} onAutoplay={(enabled, seconds) => void saveVisualAutoplay(enabled, seconds)}
        sounds={studioState.soundEffects} onSound={(effect) => void playSound(effect)} onStopSound={stopSound}
        onCue={playCue} onStopEffects={stopEffects} cueState={cueState} cueVolume={cueVolume} onCueVolume={setCueVolume}
        musicState={musicState} musicVolume={musicVolume} musicLoop={musicLoop}
        musicEnabled={musicEnabled} onMusicEnabled={(enabled) => { setMusicEnabled(enabled); if (!enabled) musicDeckRef.current?.stop(); }}
        onMusic={(track) => { setMusicEnabled(true); setMusicTrackId(track.id); void musicDeckRef.current?.play(track); }} onStopMusic={stopMusic}
        onMusicVolume={setMusicVolume} onMusicLoop={setMusicLoop} />
      <div className="panel panel-pad"><p className="eyebrow">Live transcript</p><div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">{transcript.length ? transcript.map((entry, index) => <p key={`${entry.speaker}-${index}`}><b className="text-cyan-300">{entry.speaker === "HOST" ? "HOST" : "CALLER"}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-slate-400">Transcript events will appear and persist here during a Realtime call.</p>}</div></div>
      <details className="panel panel-pad"><summary className="eyebrow cursor-pointer">Event log</summary><div className="mt-3 max-h-40 space-y-2 overflow-auto text-xs">{studioState.events.map((event, index) => <div className="flex justify-between gap-3 border-b border-slate-800 pb-2" key={`${event.timestamp}-${index}`}><span className="text-slate-200">{event.type.replaceAll("_", " ")}</span><time className="shrink-0 text-slate-500">{eventTime(event.timestamp)}</time></div>)}</div></details>
    </aside>
  </div>
  </div>;
}
