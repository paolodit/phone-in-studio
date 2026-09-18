"use client";

import { useEffect, useRef, useState } from "react";
import { CircleStop, Send } from "lucide-react";
import { playHostAudio } from "@/lib/host-audio";

export function HostSoundcheck({ profileId }: { profileId: string }) {
  const [callerLine, setCallerLine] = useState("I've been trying to keep everyone happy, but I think I've made the problem worse.");
  const [history, setHistory] = useState<{ speaker: "HOST" | "CALLER"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Private soundcheck. Nothing here reaches a show or broadcast.");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), [profileId]);

  async function runTurn() {
    if (!callerLine.trim() || busy) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setMessage("Preparing a short presenter reply…");
    try {
      const nextHistory = [...history, { speaker: "CALLER" as const, text: callerLine.trim() }].slice(-24);
      const response = await fetch("/api/ai-host/respond", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, testMode: true, transcript: nextHistory }) });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error ?? "Unable to create a host turn.");
      const completeHistory = [...nextHistory, { speaker: "HOST" as const, text: result.text }];
      setHistory(completeHistory);
      setCallerLine("");
      setMessage("Preparing the presenter’s voice…");
      const speech = await fetch("/api/ai-host/speech", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, text: result.text }) });
      if (!speech.ok) throw new Error((await speech.json() as { error?: string }).error ?? "Unable to play the host voice.");
      const blob = await speech.blob();
      setMessage("AI-generated presenter voice playing…");
      await playHostAudio(blob, abort.signal);
      setMessage("Soundcheck complete. The presenter generated and played a reply. You can assign this host to a show.");
    } catch (error) {
      if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : "Soundcheck failed.");
    } finally {
      if (abortRef.current === abort) { abortRef.current = null; setBusy(false); }
    }
  }

  return <section className="panel panel-pad">
    <p className="eyebrow">Private soundcheck</p><h2 className="mt-1 text-lg font-bold text-white">Try this host before assigning it</h2>
    <p className="mt-2 text-sm text-slate-400">Type as the caller. The host will create and speak one short live-style reply.</p>
    <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl bg-slate-950/70 p-3 text-sm">{history.length ? history.map((entry, index) => <p key={index}><b className={entry.speaker === "HOST" ? "text-cyan-300" : "text-violet-300"}>{entry.speaker}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-slate-500">The test conversation will appear here.</p>}</div>
    <div className="mt-3 flex gap-2"><textarea aria-label="Soundcheck caller line" maxLength={4000} className="field min-h-20 flex-1" value={callerLine} onChange={(event) => setCallerLine(event.target.value)} /><button className="button-primary self-end" type="button" disabled={busy || !callerLine.trim()} onClick={() => void runTurn()}><Send className="h-4 w-4" /> {busy ? "Testing…" : "Send & speak"}</button></div>
    <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-400" role="status">{message}</p><button type="button" disabled={!busy} className="button-secondary !min-h-8 !px-3 text-xs" onClick={() => { abortRef.current?.abort(); setMessage("Soundcheck stopped."); }}><CircleStop className="h-3.5 w-3.5" /> Stop</button></div>
  </section>;
}
