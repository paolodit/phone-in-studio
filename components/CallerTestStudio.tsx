"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, ExternalLink, Headphones, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { ElevenLabsAgentVoiceProvider } from "@/lib/voice/elevenlabs-agent-provider";
import { listMicrophones, OpenAIWebRtcVoiceProvider } from "@/lib/voice/openai-webrtc-provider";
import type { LiveVoiceSession } from "@/lib/voice/types";
import type { VoiceProviderId } from "@/lib/show-format";

export type CallerTestProfile = {
  id: string;
  name: string;
  age?: number;
  location: string;
  occupation?: string;
  issueHeadline: string;
  openingSummary: string;
  portraitUrl?: string;
  voiceId: string;
};

type Levels = { input: number; output: number; inputBands: number[]; outputBands: number[] };
type TranscriptEntry = { speaker: "HOST" | "CALLER"; text: string };
const emptyLevels: Levels = { input: 0, output: 0, inputBands: Array(12).fill(0), outputBands: Array(12).fill(0) };

export function CallerTestStudio({ caller }: { caller: CallerTestProfile }) {
  const [providerId, setProviderId] = useState<VoiceProviderId>("openai");
  const [session, setSession] = useState<LiveVoiceSession | null>(null);
  const [status, setStatus] = useState("Ready for a private soundcheck");
  const [message, setMessage] = useState("This test is isolated. It will not change a show, queue, event log or live broadcast output.");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [inputDevices, setInputDevices] = useState<{ id: string; label: string }[]>([]);
  const [levels, setLevels] = useState<Levels>(emptyLevels);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const statusRef = useRef(status);
  const levelsRef = useRef(levels);

  const publish = useCallback((payload: Record<string, unknown>) => channelRef.current?.postMessage(payload), []);
  const updateStatus = useCallback((next: string) => {
    statusRef.current = next;
    setStatus(next);
    publish({ type: "status", status: next });
  }, [publish]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`caller-test:${caller.id}`);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data.type !== "request-state") return;
      channel.postMessage({ type: "status", status: statusRef.current });
      channel.postMessage({ type: "connected", connected: Boolean(sessionRef.current) });
      channel.postMessage({ type: "levels", levels: levelsRef.current });
    };
    channel.postMessage({ type: "status", status: statusRef.current });
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [caller.id]);

  useEffect(() => () => { void sessionRef.current?.endSession(); }, []);

  const end = useCallback(async () => {
    const active = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    setMuted(false);
    setLevels(emptyLevels);
    levelsRef.current = emptyLevels;
    publish({ type: "levels", levels: emptyLevels });
    publish({ type: "connected", connected: false });
    if (active) await active.endSession();
    updateStatus("Soundcheck ended");
  }, [publish, updateStatus]);

  const connect = async () => {
    setBusy(true);
    setTranscript([]);
    try {
      if (sessionRef.current) await end();
      const provider = providerId === "elevenlabs" ? new ElevenLabsAgentVoiceProvider() : new OpenAIWebRtcVoiceProvider();
      const nextSession = await provider.createSession({
        callerId: caller.id,
        showId: `private-test-${caller.id}`,
        testMode: true,
        instructions: "Private caller soundcheck",
        voiceId: caller.voiceId,
        inputDeviceId: inputDeviceId || undefined,
        onStatus: updateStatus,
        onError: (error) => setMessage(error),
        onTranscript: (entry) => {
          setTranscript((current) => [...current, entry]);
          publish({ type: "transcript", entry });
        },
        onLevels: (nextLevels) => {
          levelsRef.current = nextLevels;
          setLevels(nextLevels);
          publish({ type: "levels", levels: nextLevels });
        },
      });
      sessionRef.current = nextSession;
      setSession(nextSession);
      setInputDevices(await listMicrophones());
      publish({ type: "connected", connected: true });
      setMessage("Private caller connected. Let them open, then speak naturally and pause for their reply.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to start the private soundcheck.";
      setMessage(detail);
      updateStatus("Soundcheck could not connect");
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await session?.muteOutput(next);
    setMessage(next ? "Caller output muted in this test only." : "Caller output restored.");
  };

  const changeVolume = async (next: number) => {
    setVolume(next);
    await session?.setOutputVolume(next);
  };

  const changeInput = async (deviceId: string) => {
    setInputDeviceId(deviceId);
    if (session && deviceId) await session.switchInputDevice(deviceId);
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
    <section className="space-y-5">
      <div className="panel panel-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="eyebrow">Private test channel</p><h1 className="title mt-1">Soundcheck {caller.name}</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Hear the voice, pacing and interaction before using this caller in any show. The production broadcast remains untouched.</p></div>
          <Link href={`/callers/${caller.id}/test-output`} target="_blank" className="button-secondary"><ExternalLink className="h-4 w-4" /> Open test output</Link>
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Voice connection</p><h2 className="mt-1 text-lg font-bold text-white">{status}</h2></div><span className={`status ${session ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-300"}`}>{session ? "Test connected" : "Off air"}</span></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label><span className="label">Voice route</span><select className="field" value={providerId} onChange={(event) => setProviderId(event.target.value as VoiceProviderId)} disabled={Boolean(session)}><option value="openai">OpenAI Realtime</option><option value="elevenlabs">ElevenLabs Agent</option></select></label>
          <label><span className="label">Host microphone</span><select className="field" value={inputDeviceId} onChange={(event) => void changeInput(event.target.value)} disabled={!session}><option value="">Default microphone</option>{inputDevices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!session ? <button type="button" className="button-primary" onClick={() => void connect()} disabled={busy}><Headphones className="h-4 w-4" /> {busy ? "Connecting test caller…" : "Start private soundcheck"}</button> : <>
            <button type="button" className="button-secondary" onClick={() => void session.interrupt()}><Mic className="h-4 w-4" /> Interrupt caller</button>
            <button type="button" className="button-secondary" onClick={() => void toggleMute()}>{muted ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} {muted ? "Unmute caller" : "Mute caller"}</button>
            <button type="button" className="button-danger" onClick={() => void end()}><PhoneOff className="h-4 w-4" /> End soundcheck</button>
          </>}
        </div>
        <label className="mt-5 block"><span className="label">Caller volume</span><input className="mt-2 w-full accent-cyan-300" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => void changeVolume(Number(event.target.value))} disabled={!session} /></label>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Meter label="Host microphone" bands={levels.inputBands} tone="cyan" />
          <Meter label="Caller output" bands={levels.outputBands} tone="violet" />
        </div>
        <p className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300" role="status">{message}</p>
      </div>
    </section>

    <aside className="space-y-5">
      <CallerPreview caller={caller} levels={levels.outputBands} live={Boolean(session)} />
      <div className="panel panel-pad"><div className="flex items-center gap-2"><AudioLines className="h-4 w-4 text-cyan-300" /><p className="eyebrow">Test transcript</p></div><div className="mt-4 max-h-72 space-y-3 overflow-auto">{transcript.length ? transcript.map((entry, index) => <p key={`${entry.speaker}-${index}`} className="text-sm leading-6"><b className={entry.speaker === "CALLER" ? "text-violet-300" : "text-cyan-300"}>{entry.speaker}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-sm text-slate-500">The private transcript appears here once the soundcheck starts.</p>}</div></div>
    </aside>
  </div>;
}

function Meter({ label, bands, tone }: { label: string; bands: number[]; tone: "cyan" | "violet" }) {
  return <div><p className="label">{label}</p><div className="mt-2 flex h-12 items-end gap-1 rounded-lg bg-slate-950 p-2" aria-label={`${label} live level`}>{bands.map((band, index) => <i key={index} className={`min-w-0 flex-1 rounded-t ${tone === "cyan" ? "bg-cyan-300" : "bg-violet-400"}`} style={{ height: `${Math.max(7, band * 100)}%`, opacity: .35 + band * .65 }} />)}</div></div>;
}

function CallerPreview({ caller, levels, live }: { caller: CallerTestProfile; levels: number[]; live: boolean }) {
  return <div className="panel overflow-hidden">
    <div className="relative aspect-square bg-slate-950">{caller.portraitUrl ? <img className="h-full w-full object-cover" src={caller.portraitUrl} alt={`${caller.name} caller graphic`} /> : <div className="grid h-full place-items-center text-slate-600"><Headphones className="h-20 w-20" /></div>}<div className="absolute bottom-4 left-4 flex h-14 w-24 items-center justify-center gap-1 rounded-lg bg-slate-950/60 p-2 backdrop-blur">{levels.slice(0, 8).map((band, index) => <i key={index} className="w-1.5 rounded-full bg-cyan-200" style={{ height: `${Math.max(6, band * 42)}px` }} />)}</div></div>
    <div className="p-5"><div className="flex items-center justify-between gap-3"><p className="eyebrow">Private preview</p><span className={`status ${live ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-400"}`}>{live ? "Testing" : "Idle"}</span></div><h2 className="mt-2 text-2xl font-black text-white">{caller.name}</h2><p className="mt-1 text-sm text-slate-400">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p><p className="mt-5 text-lg font-bold text-white">{caller.issueHeadline}</p></div>
  </div>;
}
