import { describe, expect, it } from "vitest";
import { starterPackIssue, starterPackMenu, starterPacks } from "@/lib/starter-packs";
import { channelCreationModes, defaultChannelCreationMode } from "@/lib/channel-creation-options";
import { readyTestPack } from "./fixtures/starter-pack";
import { readBackgroundMusic } from "@/lib/background-music";

describe("starter pack catalogue", () => {
  it("keeps the requested entry order and human-hosted default", () => {
    expect(channelCreationModes.map((mode) => mode.name)).toEqual(["Give Me the Keys", "I’ll Take the Mic", "Auto-run the Show"]);
    expect(defaultChannelCreationMode).toBe("human");
    expect(starterPacks.filter((pack) => pack.mode === "human").map((pack) => pack.name)).toEqual(["Am I the A**hole?", "Who Booked These Guests?", "Bad Joke Hotline"]);
    expect(starterPacks.filter((pack) => pack.mode === "auto")).toHaveLength(1);
  });
  it("reserves six independent guests for human packs, five for auto, without inventing final casts", () => {
    for (const pack of starterPacks) {
      expect(pack.expectedGuests).toBe(pack.mode === "human" ? 6 : 5);
      if (pack.editorialStatus === "ready") {
        expect(pack.cast).toHaveLength(pack.expectedGuests);
        expect(starterPackIssue(pack)).toBeNull();
      } else {
        expect(starterPackIssue(pack)).toContain("confirmed");
      }
      expect(pack.defaults.music.enabled).toBe(true);
      expect(pack.defaults.imageAutoplay.enabled).toBe(true);
    }
  });
  it("publishes only menu metadata, not private character material", () => {
    expect(starterPackMenu.every((item) => !Object.hasOwn(item, "cast") && !Object.hasOwn(item, "instructions"))).toBe(true);
  });
  it("won't release a pack with the wrong count, repeated guest ID or missing presenter", () => {
    const pack = readyTestPack(); expect(starterPackIssue(pack)).toBeNull();
    expect(starterPackIssue({ ...pack, cast: pack.cast.slice(1) })).not.toBeNull();
    expect(starterPackIssue({ ...pack, cast: pack.cast.map((guest) => ({ ...guest, id: "same" })) })).not.toBeNull();
    const auto = readyTestPack("auto"); expect(starterPackIssue(auto)).toBeNull();
    expect(starterPackIssue({ ...auto, presenter: undefined })).not.toBeNull();
  });
});

describe("music defaults", () => {
  it("keeps existing/custom channels off and reads copied pack defaults", () => {
    expect(readBackgroundMusic({}).enabled).toBe(false);
    expect(readBackgroundMusic({ backgroundMusic: starterPacks[0].defaults.music })).toEqual(starterPacks[0].defaults.music);
  });
  it("bounds volume and rejects unknown track IDs", () => {
    expect(readBackgroundMusic({ backgroundMusic: { trackId: "bad", volume: 20 } })).toMatchObject({ trackId: "late-night-radio", volume: 1 });
    expect(readBackgroundMusic({ backgroundMusic: { volume: NaN } }).volume).toBe(0.18);
  });
});
