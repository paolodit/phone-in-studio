import { describe, expect, it } from "vitest";
import { broadcastPresentation, normalizeAudioLevels } from "@/lib/broadcast-presentation";

describe("broadcast presentation", () => {
  it.each(["SHOW_IDLE", "SHOW_BREAK", "SHOW_ENDED"])("hides stale caller data in %s", (state) => {
    expect(broadcastPresentation(state).showCaller).toBe(false);
    expect(broadcastPresentation(state).live).toBe(false);
  });
  it.each(["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_ON_HOLD", "CALLER_ENDED"])("does not advertise %s as on air", (state) => {
    expect(broadcastPresentation(state).showCaller).toBe(true);
    expect(broadcastPresentation(state).live).toBe(false);
  });
  it("only animates real caller signal while live", () => expect(broadcastPresentation("CALLER_LIVE").live).toBe(true));
  it("rejects malformed or nonfinite audio frames", () => {
    expect(normalizeAudioLevels(null).level).toBe(0);
    const result = normalizeAudioLevels({ level: NaN, bands: [Infinity, -1, 2, ...Array(9).fill(.5)] });
    expect(result.level).toBe(0); expect(result.bands.slice(0, 3)).toEqual([0, 0, 1]);
    expect(normalizeAudioLevels({ bands: [1] }).bands).toHaveLength(12);
  });
});
