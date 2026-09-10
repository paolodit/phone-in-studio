"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Play, Trash2 } from "lucide-react";
import { deleteRecording, listRecordings, recordingBlob, recoverRecording, saveRecording } from "@/lib/recording-store";
import { recordingFilename, recordingTime, type LocalRecording } from "@/lib/recording-model";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function RecordingLibrary({ showId }: { showId: string }) {
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [selected, setSelected] = useState<LocalRecording | null>(null);
  const [url, setUrl] = useState("");
  const urlRef = useRef("");
  const audio = useRef<HTMLAudioElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => { try { setRecordings(await listRecordings(showId)); } catch (error) { setMessage((error as Error).message); } finally { setReady(true); } }, [showId]);
  useEffect(() => { void load(); return () => URL.revokeObjectURL(urlRef.current); }, [load]);
  const open = async (recording: LocalRecording) => {
    setBusy(true); setMessage("");
    try { const blob = await recordingBlob(recording); if (!blob.size) throw new Error("No saved audio chunks yet. If recording is still running, stop and save it in the Studio first."); URL.revokeObjectURL(urlRef.current); urlRef.current = URL.createObjectURL(blob); setUrl(urlRef.current); setSelected(recording); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const remove = async (recording: LocalRecording) => {
    if (!window.confirm("Permanently delete this local recording, transcript and markers? Download anything you want to keep first. Do not delete a capture that is still running in another window.")) return;
    try { await deleteRecording(recording.id); if (selected?.id === recording.id) { setSelected(null); setUrl(""); URL.revokeObjectURL(urlRef.current); } await load(); } catch (error) { setMessage((error as Error).message); }
  };
  const recover = async (recording: LocalRecording) => {
    setBusy(true); setMessage("");
    try { const recovered = await recoverRecording(recording); await load(); if (selected?.id === recovered.id) await open(recovered); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const seek = (seconds: number) => { if (audio.current) { audio.current.currentTime = seconds; void audio.current.play().catch(() => setMessage("Press play to listen from the selected marker.")); } };
  const editMarker = async (id: string, label: string) => {
    if (!selected || selected.status === "recording") return;
    const next = { ...selected, markers: selected.markers.map((marker) => marker.id === id ? { ...marker, label: label.trim() || marker.label } : marker) };
    try { await saveRecording(next); setSelected(next); await load(); } catch (error) { setMessage((error as Error).message); }
  };
  const exportAudio = async () => {
    if (!selected) return; setBusy(true);
    try { download(await recordingBlob(selected), `${recordingFilename(selected.showTitle, selected.startedAt)}.${selected.mimeType.includes("mp4") ? "m4a" : "webm"}`); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  return <div className="space-y-5"><div className="rounded-xl border border-amber-300/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">Recordings belong to this browser and this site address, not the server. Download a copy: clearing browser data can remove them. Audio and transcripts remain private; nothing here changes the broadcast.</div>
    {message && <p role="alert" className="rounded-xl bg-rose-950/40 p-4 text-sm text-rose-100">{message}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><section className="panel panel-pad">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-white">Your captures</h2><button className="text-xs text-cyan-200" onClick={() => void load()}>Refresh</button></div>
      {!ready ? <p className="mt-4 text-sm text-slate-400">Loading local recordings…</p> : !recordings.length ? <p className="mt-4 text-sm leading-6 text-slate-400">No recordings in this browser yet. In Studio, choose Start recording, share the Studio tab’s audio and check the two meters.</p> : <ul className="mt-4 space-y-3">{recordings.map((item) => <li key={item.id} className={`rounded-xl border p-3 ${selected?.id === item.id ? "border-cyan-300/50 bg-cyan-950/20" : "border-slate-800"}`}>
        <button disabled={busy} className="w-full text-left" onClick={() => void open(item)}><p className="text-sm font-bold text-white">{new Date(item.startedAt).toLocaleString()}</p><p className="mt-2 text-xs text-slate-400">{recordingTime(item.durationSeconds)} · {item.markers.length} moments · {item.status === "recording" ? "unfinished / still recording" : item.status}</p></button>
        <div className="mt-3 flex flex-wrap gap-3">{item.status === "recording" && <button disabled={busy} className="text-xs text-cyan-200" onClick={() => void recover(item)}>Recover unfinished capture</button>}<button disabled={busy || item.status === "recording"} className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-200" onClick={() => void remove(item)}><Trash2 className="h-3 w-3" />Delete</button></div>
      </li>)}</ul>}
    </section>
      <section className="panel panel-pad min-w-0">{!selected ? <div className="py-12 text-center"><Play className="mx-auto h-8 w-8 text-cyan-300" /><h2 className="mt-4 text-xl font-bold text-white">The good bits, ready to find</h2><p className="mt-3 text-sm text-slate-400">Choose a capture to listen, jump to a moment and download it.</p></div> : <>
        <p className="eyebrow">After the show</p><h2 className="mt-2 text-xl font-bold text-white">{selected.showTitle}</h2><p className="mt-2 text-xs text-slate-400">{selected.includesMicrophone ? "Studio tab + microphone" : "Studio tab only"} · {recordingTime(selected.durationSeconds)}</p>
        {(selected.status !== "ready" || selected.note) && <p className="mt-4 rounded-lg bg-amber-950/30 p-3 text-sm text-amber-100">{selected.note || "This capture may still be running or ended unexpectedly. Saved chunks may be incomplete; check playback and download what is recoverable."}</p>}
        <audio ref={audio} src={url} controls preload="metadata" className="mt-5 w-full" />
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} className="button-primary" onClick={() => void exportAudio()}><Download className="h-4 w-4" />Download audio</button><button className="button-secondary" onClick={() => download(new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" }), `${recordingFilename(selected.showTitle, selected.startedAt)}-notes.json`)}>Markers & transcript</button><button className="button-secondary" onClick={() => download(new Blob([selected.transcript.map((entry) => `[${recordingTime(entry.seconds)}] ${entry.speaker}: ${entry.text}`).join("\n\n")], { type: "text/plain" }), `${recordingFilename(selected.showTitle, selected.startedAt)}-transcript.txt`)}>Transcript text</button></div>
        <h3 className="mt-7 font-bold text-white">Marked moments</h3><p className="mt-1 text-xs text-slate-400">Jump to a marker; rename it for later editing. Markers do not create video clips.</p><div className="mt-3 space-y-2">{selected.markers.length ? selected.markers.map((marker) => <div key={marker.id} className="flex items-center gap-3 rounded-lg bg-slate-950/60 p-3"><button className="font-mono text-sm text-cyan-200" onClick={() => seek(marker.seconds)} aria-label={`Play ${marker.label}`}>{recordingTime(marker.seconds)}</button><input className="field mt-0" defaultValue={marker.label} key={`${marker.id}:${marker.label}`} aria-label={`Label at ${recordingTime(marker.seconds)}`} maxLength={160} disabled={selected.status === "recording"} onBlur={(event) => { if (event.target.value !== marker.label) void editMarker(marker.id, event.target.value); }} /></div>) : <p className="py-3 text-sm text-slate-500">No moments marked. Use Mark moment while recording your next show.</p>}</div>
        <details className="mt-6"><summary className="cursor-pointer text-sm font-bold text-slate-200">Session transcript · {selected.transcript.length} entries</summary><p className="mt-3 text-xs text-slate-500">Only live transcript events received while recording are included. Timestamps mark receipt, not exact word alignment. This is not fresh transcription of the recording.</p><div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{selected.transcript.map((entry, index) => <p className="text-sm leading-6 text-slate-300" key={index}><button className="mr-2 font-mono text-xs text-cyan-200" onClick={() => seek(entry.seconds)}>{recordingTime(entry.seconds)}</button><b>{entry.speaker}</b> {entry.text}</p>)}</div></details>
      </>}</section></div>
  </div>;
}
