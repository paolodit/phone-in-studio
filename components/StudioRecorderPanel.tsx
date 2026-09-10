"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Circle, Pause, Play, Square } from "lucide-react";
import { StudioRecorder, type RecorderState } from "@/lib/studio-recorder";
import { recordingTime } from "@/lib/recording-model";

export function StudioRecorderPanel({ showId, title, callerName, inputDeviceId, transcript, stopSignal, showEnded }: {
  showId: string; title: string; callerName?: string; inputDeviceId?: string;
  transcript: { speaker: "HOST" | "CALLER"; text: string }[]; stopSignal: number; showEnded: boolean;
}) {
  const recorder = useRef<StudioRecorder | null>(null);
  const [state, setState] = useState<RecorderState>("idle");
  const [message, setMessage] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState({ tab: 0, mic: 0 });
  const [markers, setMarkers] = useState(0);
  const [label, setLabel] = useState("");
  const active = state === "starting" || state === "recording" || state === "paused" || state === "saving";
  const previousTranscript = useRef(transcript);
  useEffect(() => {
    const last = previousTranscript.current.at(-1);
    const index = last ? transcript.indexOf(last) : -1;
    for (const entry of transcript.slice(index + 1)) recorder.current?.transcript(entry);
    previousTranscript.current = transcript;
  }, [transcript]);
  useEffect(() => { if (stopSignal) recorder.current?.stop(); }, [stopSignal]);
  useEffect(() => { if (showEnded) recorder.current?.stop(); }, [showEnded]);
  useEffect(() => () => { recorder.current?.stop("Studio was closed or navigated away. Check the saved capture before use."); }, []);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const end = () => recorder.current?.stop("Page closed during recording. Only saved chunks may be recoverable.");
    window.addEventListener("beforeunload", warn); window.addEventListener("pagehide", end);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", end); };
  }, [active]);
  const start = () => {
    setElapsed(0); setMarkers(0); setMessage("");
    const instance = new StudioRecorder({ showId, showTitle: title, includeMicrophone: includeMic, inputDeviceId,
      onState: (next, text) => { setState(next); if (text) setMessage(text); },
      onTick: (seconds, tab, mic) => { setElapsed(seconds); setLevels({ tab, mic }); },
      onSaved: () => setLevels({ tab: 0, mic: 0 }),
    });
    recorder.current = instance; void instance.start();
  };
  const mark = () => { recorder.current?.mark(label || `${callerName ?? "Show"} · Moment ${markers + 1}`); setMarkers((n) => n + 1); setLabel(""); };
  return <section className="panel panel-pad" aria-label="Show recording">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Circle aria-hidden="true" className={`h-3 w-3 ${state === "recording" ? "fill-rose-400 text-rose-400" : "text-slate-500"}`} /><div><p className="eyebrow">Keep the good moments</p><h2 className="mt-1 font-bold text-white">{active ? `${state === "paused" ? "Paused" : state === "recording" ? "Recording" : state === "saving" ? "Saving" : "Setting up"} · ${recordingTime(elapsed)}` : "Record your show"}</h2></div></div><Link href={`/shows/${showId}/recordings`} target={active ? "_blank" : undefined} className="text-sm font-semibold text-cyan-200">Recordings{active ? " ↗" : " →"}</Link></div>
    {!active ? <div className="mt-4 space-y-3"><p className="text-xs leading-5 text-slate-400">Audio only, saved in this browser. Choose <b>this Studio tab</b> and enable <b>Share tab audio</b>. No audio is uploaded. Use headphones.</p><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={includeMic} onChange={(event) => setIncludeMic(event.target.checked)} />Include my microphone</label><button className="button-secondary" onClick={start}><Circle className="h-4 w-4 text-rose-300" />Start recording</button></div></div> : <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">{state === "recording" && <button className="button-secondary" onClick={() => recorder.current?.pause()}><Pause className="h-4 w-4" />Pause recording</button>}{state === "paused" && <button className="button-primary" onClick={() => recorder.current?.resume()}><Play className="h-4 w-4" />Resume recording</button>}<button className="button-danger" disabled={state === "saving"} onClick={() => recorder.current?.stop()}><Square className="h-4 w-4" />{state === "starting" ? "Cancel setup" : "Stop & save"}</button></div>
      {(state === "recording" || state === "paused") && <><div className="grid gap-3 sm:grid-cols-2">{[{ name: "Tab / caller audio", value: levels.tab }, ...(includeMic ? [{ name: "Your microphone", value: levels.mic }] : [])].map((meter) => <label className="text-xs text-slate-400" key={meter.name}>{meter.name}<meter className="mt-1 block h-2 w-full" min={0} max={1} value={state === "paused" ? 0 : meter.value} /></label>)}</div><div className="flex flex-wrap gap-2"><input aria-label="Moment label (optional)" className="field mt-0 min-w-0 flex-1" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder="Optional moment label…" disabled={state !== "recording"} /><button className="button-primary" disabled={state !== "recording"} onClick={mark}><BookmarkPlus className="h-4 w-4" />Mark moment</button></div><p className="text-xs text-slate-400">{markers} marked · Check both meters before your show. Pause recording for private conversation; holding a caller does not pause this recording.</p></>}
    </div>}
    {message && <p className={`mt-3 text-xs leading-5 ${state === "error" ? "text-rose-200" : "text-slate-400"}`} role={state === "error" ? "alert" : "status"}>{message}</p>}
  </section>;
}
