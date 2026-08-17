"use client";

import { useRef, useState } from "react";
import { CircleStop, Send } from "lucide-react";

export function HostSoundcheck({ profileId }: { profileId: string }) {
  const [callerLine, setCallerLine] = useState("I've been trying to keep everyone happy, but I think I've made the problem worse.");
  const [history, setHistory] = useState<{ speaker: "HOST" | "CALLER"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Private soundcheck. Nothing here reaches a show or broadcast.");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function runTurn() {
    if (!callerLine.trim()) return;
    setBusy(true);
    try {
      const nextHistory = [...history, { speaker: "CALLER" as const, text: callerLine.trim() }];
      const response = await fetch("/api/ai-host/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, testMode: true, transcript: nextHistory }) });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error ?? "Unable to create a host turn.");
      const completeHistory = [...nextHistory, { speaker: "HOST" as const, text: result.text }];
      setHistory(completeHistory);
      setCallerLine("");
      const speech = await fetch("/api/ai-host/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, text: result.text }) });
      if (!speech.ok) throw new Error((await speech.json() as { error?: string }).error ?? "Unable to play the host voice.");
      const url = URL.createObjectURL(await speech.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setMessage("AI-generated presenter voice playing. Continue the test with another caller line.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Soundcheck failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel panel-pad">
    <p className="eyebrow">Private soundcheck</p><h2 className="mt-1 text-lg font-bold text-white">Try this host before assigning it</h2>
    <p className="mt-2 text-sm text-slate-400">Type as the caller. The host will create and speak one short live-style reply.</p>
    <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl bg-slate-950/70 p-3 text-sm">{history.length ? history.map((entry, index) => <p key={index}><b className={entry.speaker === "HOST" ? "text-cyan-300" : "text-violet-300"}>{entry.speaker}</b> <span className="text-slate-200">{entry.text}</span></p>) : <p className="text-slate-500">The test conversation will appear here.</p>}</div>
    <div className="mt-3 flex gap-2"><textarea className="field min-h-20 flex-1" value={callerLine} onChange={(event) => setCallerLine(event.target.value)} /><button className="button-primary self-end" type="button" disabled={busy || !callerLine.trim()} onClick={() => void runTurn()}><Send className="h-4 w-4" /> {busy ? "Thinking…" : "Send & speak"}</button></div>
    <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-400" role="status">{message}</p><button type="button" className="button-secondary !min-h-8 !px-3 text-xs" onClick={() => { audioRef.current?.pause(); audioRef.current = null; setMessage("Soundcheck audio stopped."); }}><CircleStop className="h-3.5 w-3.5" /> Stop</button></div>
  </section>;
}
