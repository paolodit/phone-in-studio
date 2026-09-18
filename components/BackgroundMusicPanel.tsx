"use client";

import { useState } from "react";
import { Check, Copy, LoaderCircle, Play, Square, Volume2 } from "lucide-react";
import { musicCredits, musicTracks, type DeckState } from "@/lib/studio-audio";

export function BackgroundMusicPanel({ state, volume, loop, enabled, onEnabled, onPlay, onStop, onVolume, onLoop }: {
  state: DeckState; volume: number; loop: boolean;
  enabled: boolean; onEnabled: (value: boolean) => void;
  onPlay: (track: typeof musicTracks[number]) => void; onStop: () => void;
  onVolume: (value: number) => void; onLoop: (value: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const active = state.status === "playing" || state.status === "loading";
  return <div className="mt-4 space-y-4">
    <p className="text-xs leading-5 text-slate-400">Ten vocal-free beds for conversation, intros and breaks. Play any track below, or start your selected track when you Start/Answer the show.</p>
    <label className="flex items-center gap-2 text-sm font-bold text-cyan-100"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} />Background music on</label>
    <p className="text-[11px] leading-5 text-slate-400">{enabled ? "Ready for your next Start/Answer action. Browser sound permission may be required. Stop turns it off, including on your next visit." : "Off. Play a track or enable it for your next Start/Answer action."} These music preferences are saved for this channel in this browser.</p>
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-3"><label htmlFor="music-volume" className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Volume2 className="h-3.5 w-3.5" />Music volume <span className="font-mono text-cyan-200">{Math.round(volume * 100)}%</span></label><button type="button" disabled={!active} onClick={onStop} className="flex items-center gap-1.5 rounded-lg bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-40"><Square className="h-3 w-3" />Stop</button></div>
      <input id="music-volume" aria-label="Background music volume" className="mt-3 w-full accent-cyan-300" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolume(Number(event.target.value))} />
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={loop} onChange={(event) => onLoop(event.target.checked)} />Repeat track</label>
    </div>
    <div className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-label="Background soundtrack library">{musicTracks.map((track) => {
      const selected = active && state.id === track.id;
      return <button type="button" key={track.id} aria-label={selected ? `Stop ${track.title}` : `Play ${track.title}`} aria-pressed={selected} onClick={() => selected ? onStop() : onPlay(track)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? "border-cyan-300/50 bg-cyan-950/35" : "border-slate-800 bg-slate-950/45 hover:border-slate-500"}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{selected && state.status === "loading" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : selected ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}</span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-100">{track.title}</span><span className="mt-1 block text-[11px] text-slate-400">{track.mood}</span></span><span className="text-[10px] tabular-nums text-slate-500">{track.duration}</span>
      </button>;
    })}</div>
    <div className="border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-400"><p>Music by <a href="https://incompetech.com" target="_blank" rel="noreferrer" className="text-cyan-200 underline">Kevin MacLeod</a> · CC BY 4.0. Royalty-free with credit: paste the credits into your stream/video description. Platform claim systems can still make mistakes.</p><div className="mt-2 flex flex-wrap gap-3"><button type="button" className="inline-flex items-center gap-1.5 font-bold text-cyan-200" onClick={async () => { setShowCredits(true); try { await navigator.clipboard.writeText(musicCredits); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Credits copied" : "Copy music credits"}</button><a href="/audio/CREDITS.txt" target="_blank" className="underline" rel="noreferrer">Sources & licences</a></div>{showCredits && <textarea aria-label="Music attribution to copy" readOnly value={musicCredits} className="field mt-3 text-[11px]" rows={6} />}</div>
    {state.error && <p role="alert" className="text-xs text-rose-200">{state.error}</p>}
  </div>;
}
