import { describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { builtInCues, clampAudioVolume, musicCredits, musicTracks, StudioAudioDeck } from "@/lib/studio-audio";
import provenance from "@/public/audio/provenance.json";

function makeDeck() {
  const notify = vi.fn();
  const audios = new Map<string, ReturnType<typeof makeAudio>>();
  function makeAudio() { return { play: vi.fn(async () => {}), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), currentTime: 0, volume: 1, loop: false, preload: "", onended: null as null | (() => void), onerror: null as null | (() => void) }; }
  const deck = new StudioAudioDeck(notify, 0.18, (url) => { const audio = makeAudio(); audios.set(url, audio); return audio as unknown as HTMLAudioElement; });
  return { deck, notify, audios };
}
describe("Studio music and real sound cues", () => {
  it("bundles ten credited instrumental selections and seven phone/sound cues", () => {
    expect(musicTracks).toHaveLength(10); expect(builtInCues).toHaveLength(7);
    expect(new Set(musicTracks.map((track) => track.id)).size).toBe(10);
    for (const track of musicTracks) { expect(track.url.startsWith("/audio/music/")).toBe(true); expect(musicCredits).toContain(track.title); }
    expect(musicCredits).toContain("creativecommons.org/licenses/by/4.0");
  });
  it("verifies every packaged audio file against its provenance hash", () => {
    expect(provenance.assets).toHaveLength(17);
    for (const asset of provenance.assets) {
      const path = `public/audio/${asset.file}`; expect(existsSync(path)).toBe(true);
      expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(asset.sha256);
      expect(asset.durationSeconds).toBeGreaterThan(0.1);
      expect(asset.licence).toBe(asset.kind === "music" ? "CC-BY-4.0" : "CC0-1.0");
    }
  });
  it("plays only one track at a time with live volume and repeat controls", async () => {
    const { deck, audios, notify } = makeDeck(); deck.setLoop(true);
    await deck.play(musicTracks[0]); const first = audios.get(musicTracks[0].url)!;
    expect(first.volume).toBe(0.18); expect(first.loop).toBe(true);
    deck.setVolume(0.4); expect(first.volume).toBe(0.4);
    await deck.play(musicTracks[1]); expect(first.pause).toHaveBeenCalled(); expect(first.currentTime).toBe(0);
    expect(notify).toHaveBeenLastCalledWith({ status: "playing", id: musicTracks[1].id });
    deck.stop(); expect(notify).toHaveBeenLastCalledWith({ status: "idle" }); expect(audios.get(musicTracks[1].url)!.pause).toHaveBeenCalled();
  });
  it("does not restart a track whose play promise resolves after Stop", async () => {
    const { deck, audios, notify } = makeDeck(); deck.preload([musicTracks[0]]);
    let resolve!: () => void; const audio = audios.get(musicTracks[0].url)!;
    audio.play.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = deck.play(musicTracks[0]); deck.stop(); resolve(); await pending;
    expect(notify).toHaveBeenLastCalledWith({ status: "idle" }); expect(audio.pause.mock.calls.length).toBeGreaterThan(1);
  });
  it("ignores a stale track failure after a different track starts", async () => {
    const { deck, audios, notify } = makeDeck(); deck.preload([musicTracks[0]]);
    let reject!: () => void; audios.get(musicTracks[0].url)!.play.mockImplementation(() => new Promise((_, fail) => { reject = () => fail(new Error("aborted")); }));
    const pending = deck.play(musicTracks[0]); await deck.play(musicTracks[1]); reject(); await pending;
    expect(notify).toHaveBeenLastCalledWith({ status: "playing", id: musicTracks[1].id });
  });
  it("reports playback failures and releases audio on unmount", async () => {
    const { deck, audios, notify } = makeDeck(); deck.preload([builtInCues[0]]);
    const audio = audios.get(builtInCues[0].url)!; audio.play.mockRejectedValue(new Error("blocked"));
    await deck.play(builtInCues[0]); expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ status: "error" }));
    deck.dispose(); expect(audio.removeAttribute).toHaveBeenCalledWith("src"); expect(audio.onerror).toBeNull();
  });
  it("ends naturally and clamps invalid volume values", async () => {
    const { deck, audios, notify } = makeDeck(); await deck.play(builtInCues[0]); audios.get(builtInCues[0].url)!.onended?.();
    expect(notify).toHaveBeenLastCalledWith({ status: "idle" }); expect(clampAudioVolume(2)).toBe(1); expect(clampAudioVolume(-1)).toBe(0); expect(clampAudioVolume(NaN)).toBe(0);
  });
});
