export type VisualAutoplaySettings = { enabled: boolean; intervalSeconds: number; startedAt: number };
export type PublicVisual = { label: string; url: string; creditText?: string; creditUrl?: string };
export type VisualPlaylist = { visuals: PublicVisual[]; startedAt: number; intervalSeconds: number; startIndex: number };

export function readVisualAutoplay(config: unknown): VisualAutoplaySettings {
  const root = config && typeof config === "object" ? config as Record<string, unknown> : {};
  const value = root.visualAutoplay && typeof root.visualAutoplay === "object" ? root.visualAutoplay as Record<string, unknown> : {};
  const seconds = Number(value.intervalSeconds);
  return { enabled: value.enabled === true, intervalSeconds: [5, 10, 15, 20, 30].includes(seconds) ? seconds : 10, startedAt: typeof value.startedAt === "number" && Number.isFinite(value.startedAt) ? value.startedAt : 0 };
}

export function visualPlaylistIndex(playlist: Omit<VisualPlaylist, "visuals"> & { visuals: readonly unknown[] }, now: number) {
  if (!playlist.visuals.length) return -1;
  const elapsed = Math.max(0, now - playlist.startedAt);
  return (playlist.startIndex + Math.floor(elapsed / (playlist.intervalSeconds * 1_000))) % playlist.visuals.length;
}

export function currentPlaylistVisual(playlist: VisualPlaylist, now: number) {
  return playlist.visuals[visualPlaylistIndex(playlist, now)];
}
