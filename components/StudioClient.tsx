"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BroadcastSnapshot } from "@/lib/public-show";
import type { StudioControlAction } from "@/lib/schemas";
import type { StudioState } from "@/lib/studio-state";
import type { LiveVoiceSession } from "@/lib/voice/types";
import { listMicrophones, OpenAIWebRtcVoiceProvider } from "@/lib/voice/openai-webrtc-provider";

const text = (value: unknown) => typeof value === "string" ? value : "—";
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function StudioClient({ showId, initialSnapshot, initialStudioState }: { showId: string; initialSnapshot: BroadcastSnapshot; initialStudioState: StudioState }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [studioState, setStudioState] = useState(initialStudioState);
  const [message, setMessage] = useState("Mock caller mode is ready. Add OPENAI_API_KEY when you are ready for a live browser voice session.");
  const [voiceStatus, setVoiceStatus] = useState("Mock mode");
  const [inputDevices, setInputDevices] = useState<{ id: string; label: string }[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [levels, setLevels] = useState({ input: 0, output: 0 });
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<{ speaker: "HOST" | "CALLER"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const soundRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const url = useMemo(() => `/api/shows/${showId}/events`, [showId]);
  const caller = studioState.caller;

  const refreshStudio = useCallback(async () => {
    const response = await fetch(`/api/shows/${showId}/studio-state`, { cache: "no-store" });
    if (response.ok) setStudioState(await response.json() as StudioState);
  }, [showId]);

  useEffect(() => {
    const source = new EventSource(url);
    source.addEventListener("state", (event) => setSnapshot(JSON.parse(event.data) as BroadcastSnapshot));
    source.onerror = () => setMessage("Display sync reconnecting…");
    return () => source.close();
  }, [url]);

  useEffect(() => () => { void sessionRef.current?.endSession(); }, []);

  const persistTranscript = useCallback((entry: { speaker: "HOST" | "CALLER"; text: string }) => {
    setTranscript((entries) => [...entries, entry].slice(-24));
    void fetch(`/api/shows/${showId}/transcript`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
  }, [showId]);

  const postControl = useCallback(async (action: StudioControlAction) => {
    const response = await fetch(`/api/shows/${showId}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json() as BroadcastSnapshot & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Control action failed.");
    setSnapshot(data);
    await refreshStudio();
  }, [refreshStudio, showId]);

  const triggerVisual = useCallback(async (assetId: string | null) => {
    const response = await fetch(`/api/shows/${showId}/visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId }) });
    const data = await response.json() as BroadcastSnapshot & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to update the visual.");
    setSnapshot(data);
    setMessage(assetId ? "Broadcast visual shown." : "Broadcast visual cleared.");
    await refreshStudio();
  }, [refreshStudio, showId]);

  const connectRealtime = useCallback(async () => {
    if (!caller) throw new Error("Cue a caller before connecting a voice session.");
    setVoiceStatus("Connecting to Realtime…");
    const provider = new OpenAIWebRtcVoiceProvider();
    const session = await provider.createSession({
      showId,
      callerId: caller.id,
      instructions: "",
      voiceId: text(caller.performance.voiceId),
      inputDeviceId: inputDeviceId || undefined,
      onTranscript: persistTranscript,
      onLevels: setLevels,
      onStatus: setVoiceStatus,
      onError: (error) => setMessage(error),
      onVisualTrigger: triggerVisual,
    });
    sessionRef.current = session;
    await session.setOutputVolume(volume);
    const devices = await listMicrophones();
    setInputDevices(devices);
    if (!inputDeviceId && devices[0]) setInputDeviceId(devices[0].id);
    await postControl("MOCK_CONNECT");
    setMessage("Realtime caller connected. The host microphone is live; caller audio plays in this browser.");
  }, [caller, inputDeviceId, persistTranscript, postControl, showId, triggerVisual, volume]);

  const control = useCallback(async (action: StudioControlAction) => {
    setBusy(true);
    try {
      if (action === "INTERRUPT_CALLER") await sessionRef.current?.interrupt();
      if (action === "MUTE_CALLER") { await sessionRef.current?.muteOutput(true); setMuted(true); }
      if (action === "UNMUTE_CALLER") { await sessionRef.current?.muteOutput(false); setMuted(false); }
      if (["END_CALL", "SKIP_CALLER", "EMERGENCY_STOP", "END_SHOW"].includes(action)) {
        await sessionRef.current?.endSession();
        sessionRef.current = null;
        setVoiceStatus("Disconnected");
        setLevels({ input: 0, output: 0 });
      }
      await postControl(action);
      if (action === "ANSWER_CALL") {
        try {
          await connectRealtime();
        } catch (error) {
          await postControl("MOCK_CONNECT");
          setVoiceStatus("Mock caller connected");
          setMessage(error instanceof Error ? `${error.message} Continuing in mock mode.` : "Realtime unavailable; continuing in mock mode.");
        }
      } else if (action === "MOCK_SPEAK") {
        setMessage("Mock caller: ‘I am not saying the fridge has favourites… but it knows what it is doing.’");
      } else {
        setMessage(`Executed ${action.replaceAll("_", " ")}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Control action failed.");
    } finally { setBusy(false); }
  }, [connectRealtime, postControl]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const controls: Record<string, StudioControlAction> = { " ": "INTERRUPT_CALLER", e: "END_CALL", m: muted ? "UNMUTE_CALLER" : "MUTE_CALLER", n: "CUE_NEXT", Escape: "EMERGENCY_STOP" };
      const action = controls[event.key];
      if (action) { event.preventDefault(); void control(action); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [control, muted]);

  const changeInput = async (deviceId: string) => {
    setInputDeviceId(deviceId);
    try { await sessionRef.current?.switchInputDevice(deviceId); setMessage("Microphone switched."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to switch microphone."); }
  };
  const changeVolume = async (next: number) => { setVolume(next); await sessionRef.current?.setOutputVolume(next); };
  const playSound = async (effect: StudioState["soundEffects"][number]) => {
    let audio = soundRef.current.get(effect.id);
    if (!audio) { audio = new Audio(effect.url); soundRef.current.set(effect.id, audio); }
    audio.loop = effect.loop;
    audio.volume = effect.volume;
    audio.currentTime = 0;
    await audio.play();
    void fetch(`/api/shows/${showId}/sound`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soundEffectId: effect.id }) });
    setMessage(`Playing sound cue: ${effect.label}.`);
  };
  const stopSound = (effectId: string) => { const audio = soundRef.current.get(effectId); if (audio) { audio.pause(); audio.currentTime = 0; } };
  const playBuiltInCue = (label: string, notes: number[]) => {
    const context = new AudioContext();
    const now = context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = label === "Applause" ? "triangle" : "sine";
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.12 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.12);
    });
    window.setTimeout(() => void context.close(), notes.length * 120 + 250);
    setMessage(`Played built-in ${label.toLowerCase()} cue.`);
  };
  const stateLabel = snapshot.broadcastState.replaceAll("_", " ");

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]"><section className="space-y-5"><div className="panel panel-pad"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Current caller</p><h2 className="mt-1 text-2xl font-black text-white">{caller?.name ?? "No caller selected"}</h2><p className="mt-1 text-sm text-slate-300">{caller ? `${caller.age ? `${caller.age} · ` : ""}${caller.location}${caller.occupation ? ` · ${caller.occupation}` : ""}` : "Cue the first queued caller after starting the show."}</p></div><span className={`status ${snapshot.broadcastState === "CALLER_LIVE" ? "bg-red-500 text-white animate-pulse" : "bg-slate-700 text-slate-200"}`}>{stateLabel}</span></div>
    {caller && <><div className="mt-5 grid gap-4 md:grid-cols-[150px_1fr]"><div className="grid aspect-square place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-violet-500 to-rose-500 text-5xl font-black text-slate-950">{caller.name.slice(0, 1)}</div><div><p className="text-xl font-bold text-white">{caller.issueHeadline}</p><p className="mt-2 text-sm leading-6 text-slate-300">{caller.openingSummary}</p><div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><div><p className="label">Private premise</p><p className="mt-1 text-slate-200">{text(caller.story.surfaceProblem)}</p></div><div><p className="label">Hidden contradiction</p><p className="mt-1 text-slate-200">{text(caller.character.comicContradiction)}</p></div><div><p className="label">Character objective</p><p className="mt-1 text-slate-200">{text(caller.character.centralWant)}</p></div><div><p className="label">Concealing</p><p className="mt-1 text-slate-200">{text(caller.story.hiddenTruth)}</p></div></div></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">{textList(caller.hostSupport.suggestedQuestions).slice(0, 3).map((prompt) => <div key={prompt} className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-sm text-cyan-50">{prompt}</div>)}</div></>}
  </div><div className="panel panel-pad"><p className="eyebrow">Live controls</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"><button disabled={busy} onClick={() => void control("START_SHOW")} className="button-primary">Start show</button><button disabled={busy} onClick={() => void control("CUE_NEXT")} className="button-secondary">Next caller <kbd>N</kbd></button><button disabled={busy} onClick={() => void control("ANSWER_CALL")} className="button-primary">Answer call</button><button disabled={busy} onClick={() => void control("INTERRUPT_CALLER")} className="button-secondary">Interrupt <kbd>Space</kbd></button><button disabled={busy} onClick={() => void control(muted ? "UNMUTE_CALLER" : "MUTE_CALLER")} className="button-secondary">{muted ? "Unmute" : "Mute"} <kbd>M</kbd></button><button disabled={busy} onClick={() => void control("HOLD_CALLER")} className="button-secondary">Put on hold</button><button disabled={busy} onClick={() => void control("RESUME_CALLER")} className="button-secondary">Resume</button><button disabled={busy} onClick={() => void control("MOCK_SPEAK")} className="button-secondary">Mock speak</button><button disabled={busy} onClick={() => void control("END_CALL")} className="button-danger">End call <kbd>E</kbd></button><button disabled={busy} onClick={() => void control("SKIP_CALLER")} className="button-secondary">Skip caller</button><button disabled={busy} onClick={() => void triggerVisual(null)} className="button-secondary">Clear visual</button><button disabled={busy} onClick={() => void control("EMERGENCY_STOP")} className="button-danger"><kbd>Esc</kbd> Stop all audio</button></div>
    <div className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 md:grid-cols-2"><div><p className="label">Voice session</p><p className="mt-1 text-sm text-cyan-200">{voiceStatus}</p><p className="mt-2 text-xs text-amber-200">Use headphones during live calls to prevent the caller hearing itself. Live browser audio needs Chrome/Edge at <b>http://localhost:3000</b> or an HTTPS URL; HTTP on a LAN/IP address cannot use the microphone.</p></div><div className="space-y-2"><label className="block"><span className="label">Host microphone</span><select className="field !mt-1" value={inputDeviceId} onChange={(event) => void changeInput(event.target.value)} disabled={!sessionRef.current}><option value="">Default microphone</option>{inputDevices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label><label className="block"><span className="label">Caller volume</span><input className="mt-2 w-full accent-cyan-300" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => void changeVolume(Number(event.target.value))} /></label><div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>Mic <i className="ml-2 inline-block h-2 w-16 rounded bg-slate-700 align-middle"><b className="block h-2 rounded bg-cyan-300" style={{ width: `${levels.input * 100}%` }} /></i></span><span>Caller <i className="ml-2 inline-block h-2 w-16 rounded bg-slate-700 align-middle"><b className="block h-2 rounded bg-rose-400" style={{ width: `${levels.output * 100}%` }} /></i></span></div></div></div><p className="mt-4 rounded-lg bg-slate-950 p-3 text-sm text-slate-300">{message}</p></div></section>
  <aside className="space-y-5"><div className="panel panel-pad"><p className="eyebrow">Up next</p><div className="mt-3 space-y-2">{studioState.queue.map((item) => <div key={item.id} className="flex gap-3 rounded-lg bg-slate-950/70 p-3"><span className="text-sm font-black text-cyan-300">{item.position}</span><div className="min-w-0"><p className="text-sm font-bold text-white">{item.name}</p><p className="truncate text-xs text-slate-400">{item.issue}</p><span className="mt-1 inline-block text-[10px] font-bold text-slate-500">{item.status}</span></div></div>)}</div></div><div className="panel panel-pad"><p className="eyebrow">Prepared visuals</p><div className="mt-3 grid grid-cols-2 gap-2">{caller?.assets.filter((asset) => asset.type === "SUPPORTING_VISUAL").map((asset, index) => <button key={asset.id} onClick={() => void triggerVisual(asset.id)} className="aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-left text-xs text-slate-200 hover:border-cyan-400"><img className="h-16 w-full object-cover opacity-70" src={asset.url} alt="" /><span className="block p-2"><b className="text-cyan-300">{asset.manualHotkey ?? index + 1}</b><br />{asset.label}</span></button>) ?? <p className="text-sm text-slate-400">No caller visuals selected.</p>}</div></div><div className="panel panel-pad"><p className="eyebrow">Soundboard</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => playBuiltInCue("Incoming call", [660, 880])} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">▶ Incoming</button><button onClick={() => playBuiltInCue("Connection", [880])} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">▶ Connect</button><button onClick={() => playBuiltInCue("Call ended", [440, 330])} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">▶ End call</button><button onClick={() => playBuiltInCue("Applause", [440, 554, 659])} className="rounded-lg bg-slate-800 p-2 text-left text-xs font-bold text-slate-100 hover:bg-slate-700">▶ Applause</button>{studioState.soundEffects.map((effect) => <div key={effect.id} className="rounded-lg border border-slate-700 bg-slate-950 p-2"><button onClick={() => void playSound(effect)} className="w-full text-left text-xs font-bold text-slate-100 hover:text-cyan-200">▶ {effect.label}</button><button onClick={() => stopSound(effect.id)} className="mt-2 text-[10px] font-bold uppercase text-slate-500">Stop</button></div>)}</div><p className="mt-3 text-xs text-slate-500">Add URL-based custom cues from the show page.</p></div><div className="panel panel-pad"><p className="eyebrow">Live transcript</p><div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">{transcript.length ? transcript.map((entry, index) => <p key={`${entry.speaker}-${index}`}><b className="text-cyan-300">{entry.speaker === "HOST" ? "HOST" : "CALLER"}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-slate-400">Transcript events will appear and persist here during a Realtime call.</p>}</div></div><div className="panel panel-pad"><p className="eyebrow">Event log</p><div className="mt-3 max-h-40 space-y-2 overflow-auto text-xs">{studioState.events.map((event, index) => <div className="flex justify-between gap-3 border-b border-slate-800 pb-2" key={`${event.timestamp}-${index}`}><span className="text-slate-200">{event.type.replaceAll("_", " ")}</span><time className="shrink-0 text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</time></div>)}</div></div></aside></div>;
}
