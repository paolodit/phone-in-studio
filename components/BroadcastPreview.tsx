"use client";

import { useEffect, useState } from "react";
import { BroadcastStage, type BroadcastLayout } from "@/components/BroadcastStage";
import { silentBands } from "@/lib/broadcast-presentation";
import type { BroadcastSnapshot } from "@/lib/public-show";

const canvases = { wide: { label: "Twitch / OBS · 16:9", ratio: "16 / 9", width: 1000, layout: "twitch" }, portrait: { label: "TikTok · 9:16", ratio: "9 / 16", width: 360, layout: "tiktok" }, square: { label: "Square · 1:1", ratio: "1 / 1", width: 600, layout: "web" }, short: { label: "Small pane · 640 × 240", ratio: "8 / 3", width: 640, layout: "web" } } as const;

export function BroadcastPreview({ initialSnapshot, broadcastUrl }: { initialSnapshot: BroadcastSnapshot; broadcastUrl: string }) {
  const [canvas, setCanvas] = useState<keyof typeof canvases>("wide");
  const [state, setState] = useState("CALLER_LIVE");
  const [mode, setMode] = useState<"full" | "overlay">("full");
  const [showVisual, setShowVisual] = useState(true);
  const [showPortrait, setShowPortrait] = useState(true);
  const [testMeter, setTestMeter] = useState(false);
  const [bands, setBands] = useState(silentBands);
  const [message, setMessage] = useState("");
  const selected = canvases[canvas];
  const caller = initialSnapshot.caller ?? { name: "Alex R", location: "Bristol", occupation: "A fictional caller", issueHeadline: "I said yes to a promotion, but I am not sure I wanted it.", openingSummary: "A caller caught between what looks good on paper and what they actually want." };
  useEffect(() => {
    if (!testMeter) { setBands(silentBands); return; }
    const interval = setInterval(() => setBands(silentBands.map((_, index) => .15 + .65 * Math.abs(Math.sin(performance.now() / 230 + index * .8)))), 50);
    return () => clearInterval(interval);
  }, [testMeter]);
  const snapshot: BroadcastSnapshot = { ...initialSnapshot, broadcastState: state, caller: { ...caller, visual: showVisual ? caller.visual : undefined, portraitUrl: showPortrait ? caller.portraitUrl : undefined } };
  const copy = async () => {
    try { const url = new URL(broadcastUrl, window.location.origin); url.searchParams.set("layout", selected.layout); url.searchParams.set("mode", mode); await navigator.clipboard.writeText(url.toString()); setMessage("Live output URL copied. Keep this link private."); }
    catch { setMessage("Clipboard unavailable. Open the live output from the show page and copy its address."); }
  };
  return <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
    <section className="panel panel-pad space-y-4">
      <div><p className="eyebrow">Private preview</p><p className="mt-2 text-xs leading-5 text-slate-400">These controls never change the live show, queue or sound. The same renderer powers your actual output.</p></div>
      <label className="block"><span className="label">Canvas</span><select className="field" value={canvas} onChange={(event) => setCanvas(event.target.value as keyof typeof canvases)}>{Object.entries(canvases).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
      <label className="block"><span className="label">Preview state</span><select className="field" value={state} onChange={(event) => setState(event.target.value)}>{["SHOW_IDLE", "CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD", "CALLER_ENDED", "SHOW_BREAK", "SHOW_ENDED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="block"><span className="label">Background</span><select className="field" value={mode} onChange={(event) => setMode(event.target.value as "full" | "overlay")}><option value="full">Full presentation</option><option value="overlay">Transparent overlay</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showVisual} disabled={!caller.visual} onChange={(event) => setShowVisual(event.target.checked)} />Topic image</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPortrait} onChange={(event) => setShowPortrait(event.target.checked)} />Caller portrait</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={testMeter} onChange={(event) => setTestMeter(event.target.checked)} />Simulate EQ (no sound)</label>
      <button type="button" className="button-secondary w-full" onClick={() => void copy()}>Copy live output URL</button>
      {message && <p role="status" className="text-xs text-cyan-200">{message}</p>}
    </section>
    <div className="min-w-0"><div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400"><span>{selected.label}</span><span>PREVIEW ONLY {testMeter ? "· simulated signal" : "· silent"}</span></div><div className="mx-auto overflow-hidden rounded-lg border border-slate-700 bg-[repeating-conic-gradient(#263244_0%_25%,#172231_0%_50%)] bg-[length:20px_20px]" style={{ width: `min(100%, ${selected.width}px)`, aspectRatio: selected.ratio }}><BroadcastStage snapshot={snapshot} mode={mode} layout={selected.layout as BroadcastLayout} audioBands={bands} hasSignal={testMeter} /></div></div>
  </div>;
}
