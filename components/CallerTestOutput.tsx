"use client";

import { useEffect, useState } from "react";
import { Headphones } from "lucide-react";
import type { CallerTestProfile } from "@/components/CallerTestStudio";

const emptyBands = Array(12).fill(0) as number[];

export function CallerTestOutput({ caller }: { caller: CallerTestProfile }) {
  const [bands, setBands] = useState(emptyBands);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Waiting for private soundcheck");

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`caller-test:${caller.id}`);
    channel.onmessage = (event: MessageEvent<{ type?: string; levels?: { outputBands?: number[] }; connected?: boolean; status?: string }>) => {
      if (event.data.type === "levels" && event.data.levels?.outputBands) setBands(event.data.levels.outputBands);
      if (event.data.type === "connected") setConnected(Boolean(event.data.connected));
      if (event.data.type === "status" && event.data.status) setStatus(event.data.status);
    };
    channel.postMessage({ type: "request-state" });
    return () => channel.close();
  }, [caller.id]);

  return <main className="min-h-screen overflow-hidden bg-[#07101f] text-white">
    <section className="relative flex min-h-screen items-center justify-center p-[5vw]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(34,211,238,.18),transparent_42%),radial-gradient(circle_at_20%_80%,rgba(139,92,246,.16),transparent_38%)]" />
      <div className="relative z-10 grid w-full max-w-6xl items-center gap-[4vw] lg:grid-cols-[minmax(280px,.8fr)_minmax(420px,1.2fr)]">
        <div className="relative aspect-square overflow-hidden bg-slate-900">{caller.portraitUrl ? <img className="h-full w-full object-cover" src={caller.portraitUrl} alt={`${caller.name} caller graphic`} /> : <div className="grid h-full place-items-center text-slate-600"><Headphones className="h-28 w-28" /></div>}
          <div className="absolute bottom-[4%] left-[4%] flex h-[12.5%] w-[28%] items-center justify-center gap-[3%] bg-transparent" aria-label="Caller audio level">{bands.slice(0, 9).map((band, index) => <i key={index} className="w-[7%] rounded-full bg-cyan-100 shadow-[0_0_12px_rgba(165,243,252,.45)]" style={{ height: `${Math.max(12, band * 96)}%`, transformOrigin: "center" }} />)}</div>
        </div>
        <div className="border-l border-cyan-300/20 pl-[4vw]"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[clamp(.7rem,1.2vw,1rem)] font-black uppercase tracking-[.28em] text-cyan-300">Private caller test</p><span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider ${connected ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-300"}`}>{connected ? "Soundcheck" : "Off air"}</span></div><h1 className="mt-6 text-[clamp(3rem,8vw,7rem)] font-black leading-[.9] text-cyan-100">{caller.name}</h1><p className="mt-4 text-[clamp(1rem,2vw,1.5rem)] font-bold text-slate-300">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p><p className="mt-10 max-w-3xl text-[clamp(1.5rem,3.2vw,3rem)] font-black leading-tight">{caller.issueHeadline}</p><p className="mt-5 max-w-3xl text-[clamp(.95rem,1.5vw,1.25rem)] leading-relaxed text-slate-300">{caller.openingSummary}</p><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-slate-500">{status} · isolated from all live shows</p></div>
      </div>
    </section>
  </main>;
}
