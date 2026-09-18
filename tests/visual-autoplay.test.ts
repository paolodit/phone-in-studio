import { describe, expect, it } from "vitest";
import { currentPlaylistVisual, readVisualAutoplay, visualPlaylistIndex } from "@/lib/visual-autoplay";
import { buildShowFormatConfig } from "@/lib/show-format";

const playlist = { visuals: [{ label: "One", url: "/one.jpg", creditText: "Jane · Pexels" }, { label: "Two", url: "/two.jpg" }, { label: "Three", url: "/three.jpg" }], intervalSeconds: 10, startedAt: 1_000, startIndex: 0 };
describe("show-wide visual autoplay", () => {
  it("defaults off, with a ten-second interval", () => {
    expect(readVisualAutoplay(null)).toEqual({ enabled: false, intervalSeconds: 10, startedAt: 0 });
    expect(readVisualAutoplay({ visualAutoplay: { enabled: "true", intervalSeconds: -4, startedAt: NaN } })).toEqual({ enabled: false, intervalSeconds: 10, startedAt: 0 });
  });
  it("loops all images and retains the creator credit", () => {
    expect(currentPlaylistVisual(playlist, 1_000)?.creditText).toBe("Jane · Pexels");
    expect(currentPlaylistVisual(playlist, 11_000)?.url).toBe("/two.jpg");
    expect(currentPlaylistVisual(playlist, 21_000)?.url).toBe("/three.jpg");
    expect(currentPlaylistVisual(playlist, 31_000)?.url).toBe("/one.jpg");
  });
  it("resumes from a manual image and is deterministic in multiple outputs", () => {
    const next = { ...playlist, startIndex: 2, startedAt: 100_000 };
    expect(visualPlaylistIndex(next, 100_000)).toBe(2);
    expect(visualPlaylistIndex(next, 110_000)).toBe(0);
    expect(visualPlaylistIndex(next, 99_000)).toBe(2);
  });
  it("handles zero and one image without a broken frame", () => {
    expect(currentPlaylistVisual({ ...playlist, visuals: [] }, 10_000)).toBeUndefined();
    expect(visualPlaylistIndex({ ...playlist, visuals: [playlist.visuals[0]] }, 123456)).toBe(0);
  });
  it("preserves autoplay when saving unrelated show setup", () => {
    const visualAutoplay = { enabled: true, intervalSeconds: 15, startedAt: 99 };
    expect(buildShowFormatConfig({ title: "Renamed" }, { visualAutoplay }).visualAutoplay).toEqual(visualAutoplay);
  });
});
