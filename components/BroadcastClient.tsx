"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BroadcastSnapshot } from "@/lib/public-show";

const emptyBands = Array.from({ length: 12 }, () => 0);

function visualCredit(label: string) {
  const provider = label.split(":", 1)[0]?.trim();
  return provider && /^(pexels|pixabay)$/i.test(provider) ? `Image: ${provider}` : "Show visual";
}

function meterBands(bands: number[] | undefined, level = 0) {
  const safe = bands?.length === 12 ? bands.map((band) => Math.max(0, Math.min(1, band))) : emptyBands;
  if (Math.max(...safe) > 0.015 || level <= 0.005) return safe;
  const shape = [0.42, 0.64, 0.82, 1, 0.7, 0.5, 0.78, 0.94, 0.66, 0.46, 0.32, 0.22];
  return shape.map((weight) => Math.min(1, level * weight * 2.6));
}

function CallerEqualizer({ bands, active }: { bands: number[]; active: boolean }) {
  return <div
    className={`pointer-events-none absolute bottom-[5%] left-[5%] flex h-[12%] w-[24%] min-w-20 items-center gap-[3px] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-30"}`}
    aria-label="Live caller audio equalizer"
  >
    {bands.map((band, index) => {
      const strength = Math.min(1, Math.pow(band, 0.62) * 1.55);
      return <i
        key={index}
        className="min-w-0 flex-1 rounded-full bg-cyan-100 shadow-[0_0_8px_rgba(165,243,252,.5)] transition-[height,opacity] duration-75"
        style={{ height: `${Math.max(10, strength * 100)}%`, opacity: 0.35 + strength * 0.65 }}
      />;
    })}
  </div>;
}

export function BroadcastClient({ initialSnapshot, token, mode }: { initialSnapshot: BroadcastSnapshot; token?: string; mode: "full" | "overlay" }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [audioBands, setAudioBands] = useState(emptyBands);
  const [hasSignal, setHasSignal] = useState(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventUrl = useMemo(() => `/api/shows/${initialSnapshot.showId}/events${token ? `?token=${encodeURIComponent(token)}` : ""}`, [initialSnapshot.showId, token]);

  useEffect(() => {
    const source = new EventSource(eventUrl);
    const onState = (event: MessageEvent) => setSnapshot(JSON.parse(event.data) as BroadcastSnapshot);
    const onAudioLevel = (event: MessageEvent) => {
      const next = JSON.parse(event.data) as { bands?: number[]; level?: number };
      const bands = meterBands(next.bands, next.level);
      setAudioBands(bands);
      setHasSignal(Math.max(next.level ?? 0, ...bands) > 0.012);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        setHasSignal(false);
        setAudioBands(emptyBands);
      }, 360);
    };
    source.addEventListener("state", onState);
    source.addEventListener("audio-level", onAudioLevel);
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      source.removeEventListener("state", onState);
      source.removeEventListener("audio-level", onAudioLevel);
      source.close();
    };
  }, [eventUrl]);

  const caller = snapshot.caller;
  const isShowBreak = snapshot.broadcastState === "SHOW_BREAK";
  const isShowEnded = snapshot.broadcastState === "SHOW_ENDED";
  const showCaller = Boolean(caller && !["SHOW_IDLE", "SHOW_BREAK", "SHOW_ENDED"].includes(snapshot.broadcastState));
  const live = snapshot.broadcastState === "CALLER_LIVE";
  const comingUp = snapshot.broadcastState === "CALLER_INCOMING";
  const connecting = snapshot.broadcastState === "CALLER_CONNECTING";
  const held = snapshot.broadcastState === "CALLER_ON_HOLD";
  const ended = snapshot.broadcastState === "CALLER_ENDED";
  const transparent = mode === "overlay";
  const topicVisual = showCaller && caller?.visual && !transparent ? caller.visual : null;
  const stateLabel = live ? "ON AIR" : comingUp ? "COMING UP" : snapshot.broadcastState.replaceAll("_", " ");
  const callerKicker = comingUp ? "Coming up next" : connecting ? "Connecting caller" : held ? "Caller on hold" : ended ? "Call ended" : "Now calling";

  return <main className={`h-screen min-h-[420px] overflow-hidden ${transparent ? "bg-transparent" : "bg-[#09101c]"}`}>
    <section className={`relative flex h-full flex-col overflow-hidden ${transparent ? "" : "bg-[radial-gradient(circle_at_75%_15%,#173c5b,transparent_34%),linear-gradient(135deg,#07111e,#101229)]"}`}>
      {!transparent && !topicVisual && <div className="absolute inset-y-0 right-[9%] w-[44%] rounded-full bg-cyan-400/10 blur-3xl" />}
      {topicVisual && <div className="absolute inset-y-0 right-0 w-[43%] max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[38%] max-md:w-full">
        <img className="h-full w-full object-cover" src={topicVisual.url} alt="" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09101c] via-[#09101c]/25 to-transparent max-md:bg-gradient-to-b max-md:from-[#09101c] max-md:via-transparent max-md:to-[#09101c]/10" />
        <span className="absolute bottom-3 right-4 rounded bg-black/45 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-white/70 backdrop-blur-sm">{visualCredit(topicVisual.label)}</span>
      </div>}

      <header className={`relative z-10 flex shrink-0 items-center justify-between gap-4 ${transparent ? "p-6 md:p-8" : "px-[clamp(1.5rem,4vw,4rem)] pt-[clamp(1.5rem,4vh,3.5rem)]"}`}>
        <div className="min-w-0"><p className="text-[10px] font-black tracking-[.28em] text-cyan-300 md:text-xs">LIVE PHONE-IN</p><h1 className="mt-1 truncate text-[clamp(1.6rem,4vw,3.4rem)] font-black tracking-tight text-white">{snapshot.title}</h1></div>
        <div className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black md:px-4 md:text-sm ${live ? "bg-rose-800 text-white" : "bg-slate-800/90 text-slate-200"}`}><span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-white" : "bg-cyan-300"}`} />{stateLabel}</div>
      </header>

      <div className={`relative z-10 flex min-h-0 flex-1 items-end px-[clamp(1.5rem,4vw,4rem)] pb-[clamp(1.5rem,5vh,4rem)] pt-6 ${topicVisual ? "pr-[clamp(1.5rem,42vw,38rem)] max-md:pb-[34vh] max-md:pr-[clamp(1.5rem,4vw,4rem)]" : ""}`}>
        {showCaller && caller ? <div className={`grid w-full items-end gap-[clamp(1rem,2.5vw,2.2rem)] ${comingUp ? "mx-auto max-w-4xl grid-cols-[minmax(110px,180px)_1fr]" : "max-w-6xl grid-cols-[minmax(180px,.72fr)_1.45fr]"} max-[700px]:grid-cols-[minmax(100px,32vw)_1fr]`}>
          <div className={`relative aspect-square overflow-hidden rounded-[clamp(1rem,3vw,2rem)] border-[3px] border-white/20 bg-gradient-to-br from-cyan-300 via-violet-500 to-rose-500 shadow-2xl shadow-black/30 ${comingUp ? "max-w-[180px]" : ""}`}>
            {caller.portraitUrl ? <img className="h-full w-full object-cover" src={caller.portraitUrl} alt="" /> : <div className="grid h-full place-items-center text-[clamp(4rem,12vw,12rem)] font-black text-slate-950/80">{caller.name.slice(0, 1)}</div>}
            {live && <CallerEqualizer bands={audioBands} active={hasSignal} />}
          </div>
          <div className={`min-w-0 rounded-[clamp(1rem,3vw,2rem)] border border-white/15 bg-slate-950/82 shadow-2xl shadow-black/20 backdrop-blur ${comingUp ? "p-[clamp(1rem,2.5vw,2rem)]" : "p-[clamp(1.25rem,3vw,2.5rem)]"}`}>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300 md:text-sm">{callerKicker}</p>
            <h2 className={`mt-2 font-black tracking-tight text-cyan-200 ${comingUp ? "text-[clamp(1.7rem,4vw,3rem)]" : "text-[clamp(2rem,5vw,4.2rem)]"}`}>{caller.name}</h2>
            <p className="mt-1 text-[clamp(.8rem,1.6vw,1.2rem)] font-semibold text-slate-300">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p>
            <p className={`max-w-3xl font-bold leading-tight text-slate-100 ${comingUp ? "mt-4 text-[clamp(1rem,2.3vw,1.7rem)]" : "mt-[clamp(1rem,3vh,2rem)] text-[clamp(1.25rem,3vw,2.5rem)]"}`}>{caller.issueHeadline}</p>
            <p className={`max-w-2xl leading-relaxed text-slate-300 ${comingUp ? "mt-2 hidden text-sm min-[850px]:block" : "mt-3 text-[clamp(.75rem,1.4vw,1.05rem)]"}`}>{caller.openingSummary}</p>
          </div>
        </div> : <div className="mx-auto max-w-3xl self-center text-center"><p className="text-xs font-black tracking-[.3em] text-cyan-300 md:text-sm">{isShowBreak ? "SHOW BREAK" : isShowEnded ? "SHOW COMPLETE" : "STANDING BY"}</p><h2 className="mt-5 text-[clamp(2.6rem,7vw,6rem)] font-black leading-[.98] text-white">{isShowBreak ? "We’ll be right back." : isShowEnded ? "Thanks for listening." : "The next call is coming in."}</h2><p className="mx-auto mt-5 max-w-xl text-[clamp(.9rem,1.7vw,1.2rem)] text-slate-300">{isShowBreak ? "The phone-in continues shortly." : isShowEnded ? snapshot.title : "Your live phone-in will continue here when the next caller is ready."}</p></div>}
      </div>
    </section>
  </main>;
}
