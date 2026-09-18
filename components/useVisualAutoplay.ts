"use client";

import { useEffect, useState } from "react";
import type { BroadcastSnapshot } from "@/lib/public-show";
import { currentPlaylistVisual } from "@/lib/visual-autoplay";

// Each output follows the same persisted clock. No Studio tab needs to stay
// foregrounded and multiple OBS/preview windows cannot advance one another.
export function useVisualAutoplay(snapshot: BroadcastSnapshot): BroadcastSnapshot {
  const [now, setNow] = useState<number | null>(null);
  const playlist = snapshot.visualPlaylist;
  useEffect(() => {
    if (!playlist) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const refresh = () => setNow(Date.now());
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [playlist]);
  return snapshot.caller && playlist && now !== null
    ? { ...snapshot, caller: { ...snapshot.caller, visual: currentPlaylistVisual(playlist, now) } }
    : snapshot;
}
