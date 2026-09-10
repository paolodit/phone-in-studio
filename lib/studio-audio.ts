import catalog from "@/public/audio/catalog.json";

export type BuiltInCueId = "incoming" | "connected" | "hostHangup" | "callerHangup" | "cheer" | "horn" | "rimshot";
export const musicTracks = catalog.music.map((track) => ({ ...track, url: `/audio/music/${track.id}.mp3`, artist: "Kevin MacLeod", licence: "CC BY 4.0", source: `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}` }));
export const builtInCues = catalog.effects.map((effect) => ({ ...effect, id: effect.id as BuiltInCueId, url: `/audio/effects/${effect.id}.mp3` }));
export const musicCredits = [
  "Music: " + musicTracks.map((track) => `“${track.title}”`).join(", "),
  "Kevin MacLeod (https://incompetech.com)",
  "Licensed under Creative Commons: By Attribution 4.0",
  "https://creativecommons.org/licenses/by/4.0/",
  "Audio loudness normalised and re-encoded for AI Phone-In Studio.",
].join("\n");

export type DeckState = { status: "idle" | "loading" | "playing" | "error"; id?: string; error?: string };
export const clampAudioVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** One item per deck; stale play promises cannot restart stopped/replaced audio. */
export class StudioAudioDeck {
  private audio = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;
  private request = 0;
  private level: number;
  private loop = false;
  constructor(private notify: (state: DeckState) => void, volume: number, private create: (url: string) => HTMLAudioElement = (url) => new Audio(url)) { this.level = clampAudioVolume(volume); }
  preload(items: { id: string; url: string }[]) { for (const item of items) { const audio = this.get(item); audio.preload = "auto"; audio.load(); } }
  private get(item: { id: string; url: string }) {
    let audio = this.audio.get(item.id);
    if (!audio) { audio = this.create(item.url); this.audio.set(item.id, audio); }
    return audio;
  }
  setVolume(value: number) { this.level = clampAudioVolume(value); if (this.current) this.current.volume = this.level; }
  setLoop(value: boolean) { this.loop = value; if (this.current) this.current.loop = value; }
  async play(item: { id: string; url: string }) {
    this.stop(false); const version = ++this.request;
    const audio = this.get(item); this.current = audio;
    audio.volume = this.level; audio.loop = this.loop; audio.currentTime = 0;
    const fail = () => {
      if (version !== this.request) return;
      this.stop(false); this.notify({ status: "error", id: item.id, error: "Audio could not play. Try again; check browser sound permissions and that the local file is available." });
    };
    audio.onerror = fail;
    audio.onended = () => { if (version === this.request) this.stop(); };
    this.notify({ status: "loading", id: item.id });
    try {
      await audio.play();
      if (version !== this.request) { if (audio !== this.current) audio.pause(); return; }
      this.notify({ status: "playing", id: item.id });
    } catch { fail(); }
  }
  stop(notify = true) {
    this.request++;
    for (const audio of this.audio.values()) { audio.pause(); audio.currentTime = 0; }
    this.current = null;
    if (notify) this.notify({ status: "idle" });
  }
  dispose() { this.stop(false); for (const audio of this.audio.values()) { audio.onended = null; audio.onerror = null; audio.removeAttribute("src"); audio.load(); } this.audio.clear(); }
}
