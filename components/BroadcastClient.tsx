"use client";

import { useEffect, useMemo, useState } from "react";
import type { BroadcastSnapshot } from "@/lib/public-show";

export function BroadcastClient({ initialSnapshot, token, mode }: { initialSnapshot: BroadcastSnapshot; token?: string; mode: "full" | "overlay" }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const eventUrl = useMemo(() => `/api/shows/${initialSnapshot.showId}/events${token ? `?token=${encodeURIComponent(token)}` : ""}`, [initialSnapshot.showId, token]);

  useEffect(() => {
    const source = new EventSource(eventUrl);
    source.addEventListener("state", (event) => setSnapshot(JSON.parse(event.data) as BroadcastSnapshot));
    return () => source.close();
  }, [eventUrl]);

  const caller = snapshot.caller;
  const live = snapshot.broadcastState === "CALLER_LIVE";
  const comingUp = snapshot.broadcastState === "CALLER_INCOMING";
  const connecting = snapshot.broadcastState === "CALLER_CONNECTING";
  const held = snapshot.broadcastState === "CALLER_ON_HOLD";
  const ended = snapshot.broadcastState === "CALLER_ENDED";
  const transparent = mode === "overlay";
  const stateLabel = live ? "ON AIR" : comingUp ? "COMING UP NEXT" : snapshot.broadcastState.replaceAll("_", " ");

  return <main className={`min-h-screen overflow-hidden ${transparent ? "bg-transparent" : "bg-[#09101c]"}`}>
    <section className={`relative flex min-h-screen flex-col overflow-hidden ${transparent ? "" : "bg-[radial-gradient(circle_at_75%_15%,#173c5b,transparent_32%),linear-gradient(135deg,#07111e,#101229)]"}`}>
      {!transparent && <div className="absolute inset-y-0 right-[9%] w-[44%] rounded-full bg-cyan-400/10 blur-3xl" />}
      <header className={`relative z-10 flex items-center justify-between ${transparent ? "p-8" : "p-10 md:p-14"}`}>
        <div><p className="text-xs font-black tracking-[.28em] text-cyan-300">LIVE PHONE-IN</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">{snapshot.title}</h1></div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${live ? "bg-red-500 text-white" : "bg-slate-800/90 text-slate-200"}`}><span className={`h-2.5 w-2.5 rounded-full ${live ? "animate-pulse bg-white" : "bg-cyan-300"}`} />{stateLabel}</div>
      </header>

      <div className={`relative z-10 flex flex-1 ${comingUp ? "items-center" : "items-end"} ${transparent ? "p-8" : "p-10 md:p-14"}`}>
        {caller ? <div className={`grid w-full gap-7 ${comingUp ? "mx-auto max-w-4xl items-center md:grid-cols-[180px_1fr]" : transparent ? "max-w-5xl grid-cols-[220px_1fr]" : "max-w-6xl items-end md:grid-cols-[minmax(280px,.8fr)_1.4fr]"}`}>
          <div className={`relative aspect-square overflow-hidden rounded-[2rem] border-4 border-white/20 bg-gradient-to-br from-cyan-300 via-violet-500 to-rose-500 shadow-2xl shadow-black/30 ${comingUp ? "md:max-w-[180px]" : ""}`}>
            {caller.portraitUrl ? <img className="h-full w-full object-cover" src={caller.portraitUrl} alt="" /> : <div className="grid h-full place-items-center text-[12rem] font-black text-slate-950/80">{caller.name.slice(0, 1)}</div>}
            {live && <div className="absolute bottom-5 left-5 right-5 flex h-8 items-center gap-1"><i className="h-3 w-1 animate-pulse rounded bg-white" /><i className="h-7 w-1 animate-pulse rounded bg-white [animation-delay:120ms]" /><i className="h-4 w-1 animate-pulse rounded bg-white [animation-delay:220ms]" /><i className="h-8 w-1 animate-pulse rounded bg-white [animation-delay:80ms]" /><i className="h-5 w-1 animate-pulse rounded bg-white [animation-delay:180ms]" /></div>}
          </div>
          <div className={`rounded-[2rem] border border-white/15 bg-slate-950/80 shadow-2xl shadow-black/20 backdrop-blur ${comingUp ? "p-6 md:p-8" : "p-7 md:p-10"}`}>
            <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">{comingUp ? "Coming up next" : connecting ? "Connecting caller" : held ? "Caller on hold" : ended ? "Call ended" : "Now calling"}</p>
            <h2 className={`mt-3 font-black tracking-tight text-white ${comingUp ? "text-4xl md:text-5xl" : "text-5xl md:text-7xl"}`}>{caller.name}</h2>
            <p className="mt-2 text-lg font-semibold text-slate-300 md:text-xl">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p>
            <p className={`max-w-3xl font-bold leading-tight text-white ${comingUp ? "mt-5 text-xl md:text-2xl" : "mt-8 text-2xl md:text-4xl"}`}>{caller.issueHeadline}</p>
            <p className={`max-w-2xl leading-7 text-slate-300 ${comingUp ? "mt-3 text-sm" : "mt-4 text-base md:text-lg"}`}>{caller.openingSummary}</p>
            {caller.visual && !transparent && <div className="mt-7 overflow-hidden rounded-xl border border-cyan-300/30 bg-cyan-300/10"><p className="px-3 pt-3 text-xs font-black uppercase tracking-[.16em] text-cyan-200">On-air topic image</p><img className="mt-2 max-h-52 w-full object-cover" src={caller.visual.url} alt="" /><p className="p-3 text-sm text-cyan-50">{caller.visual.label}</p></div>}
          </div>
        </div> : <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black tracking-[.3em] text-cyan-300">STANDING BY</p><h2 className="mt-5 text-5xl font-black text-white md:text-7xl">The next call is coming in.</h2><p className="mt-5 text-lg text-slate-300">A human host, a queue of entirely fictional callers, and no chatbot bubbles.</p></div>}
      </div>
      {!transparent && <footer className="relative z-10 flex justify-between border-t border-white/10 px-10 py-5 text-xs font-bold tracking-[.16em] text-slate-400 md:px-14"><span>AI PHONE-IN</span><span>LIVE · OBS BROWSER DISPLAY</span></footer>}
    </section>
  </main>;
}
