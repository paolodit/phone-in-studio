"use client";

import { useEffect, useState } from "react";
import type { BroadcastSnapshot } from "@/lib/public-show";
import { normalizeAudioLevels, silentBands } from "@/lib/broadcast-presentation";
import { BroadcastStage, type BroadcastLayout } from "@/components/BroadcastStage";
export type { BroadcastLayout } from "@/components/BroadcastStage";

export function BroadcastClient({ initialSnapshot, token, mode, layout }: { initialSnapshot: BroadcastSnapshot; token?: string; mode: "full" | "overlay"; layout: BroadcastLayout }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [audioBands, setAudioBands] = useState(silentBands);
  const [hasSignal, setHasSignal] = useState(false);
  useEffect(() => {
    const eventUrl = `/api/shows/${initialSnapshot.showId}/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const source = new EventSource(eventUrl);
    let silenceTimer: ReturnType<typeof setTimeout>;
    let directSignalAt = -Infinity;
    const receiveAudio = (value: unknown) => {
      const { level, bands } = normalizeAudioLevels(value);
      setAudioBands(bands);
      setHasSignal(Math.max(level, ...bands) > .012);
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { setHasSignal(false); setAudioBands(silentBands); }, 600);
    };
    const onState = (event: MessageEvent) => {
      try { setSnapshot(JSON.parse(event.data) as BroadcastSnapshot); } catch { /* Last good frame stays on air. */ }
    };
    const onAudio = (event: MessageEvent) => {
      if (performance.now() - directSignalAt < 500) return;
      try { receiveAudio(JSON.parse(event.data)); } catch { /* Ignore a malformed frame. */ }
    };
    // Same-browser previews avoid a server round trip. Separate OBS processes
    // and other machines continue to receive the authenticated SSE feed.
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`phone-in-audio:${initialSnapshot.showId}`);
    if (channel) channel.onmessage = (event) => { directSignalAt = performance.now(); receiveAudio(event.data); };
    source.addEventListener("state", onState);
    source.addEventListener("audio-level", onAudio);
    return () => { clearTimeout(silenceTimer); source.close(); channel?.close(); };
  }, [initialSnapshot.showId, token]);
  return <main className="broadcast-shell"><BroadcastStage snapshot={snapshot} mode={mode} layout={layout} audioBands={audioBands} hasSignal={hasSignal} /></main>;
}
