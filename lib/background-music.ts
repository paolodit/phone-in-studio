import catalog from "@/public/audio/catalog.json";

export type BackgroundMusicSettings = { enabled: boolean; trackId: string; volume: number; loop: boolean };
export function readBackgroundMusic(config: unknown): BackgroundMusicSettings {
  const root = config && typeof config === "object" ? config as Record<string, unknown> : {};
  const value = root.backgroundMusic && typeof root.backgroundMusic === "object" ? root.backgroundMusic as Record<string, unknown> : {};
  return {
    enabled: value.enabled === true,
    trackId: catalog.music.some((track) => track.id === value.trackId) ? String(value.trackId) : "late-night-radio",
    volume: typeof value.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : 0.18,
    loop: value.loop !== false,
  };
}
