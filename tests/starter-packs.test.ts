import { describe, expect, it } from "vitest";
import { starterPackIssue, starterPackMenu, starterPacks } from "@/lib/starter-packs";
import { channelCreationModes, defaultChannelCreationMode } from "@/lib/channel-creation-options";
import { readyTestPack } from "./fixtures/starter-pack";
import { readBackgroundMusic } from "@/lib/background-music";
import { callerFormSchema } from "@/lib/schemas";
import { showIdentitySchema } from "@/lib/show-identity";

describe("starter pack catalogue", () => {
  it("keeps the requested entry order and human-hosted default", () => {
    expect(channelCreationModes.map((mode) => mode.name)).toEqual(["Give Me the Keys", "I’ll Take the Mic", "Auto-run the Show"]);
    expect(defaultChannelCreationMode).toBe("human");
    expect(starterPacks.filter((pack) => pack.mode === "human").map((pack) => pack.name)).toEqual(["Am I the A**hole?", "Who Booked These Guests?", "Bad Joke Hotline"]);
    expect(starterPacks.filter((pack) => pack.mode === "auto")).toHaveLength(1);
  });
  it("ships eighteen complete, distinct human guests and keeps the auto theme pending", () => {
    const human = starterPacks.filter((pack) => pack.mode === "human");
    expect(human.every((pack) => pack.editorialStatus === "ready")).toBe(true);
    const guests = human.flatMap((pack) => pack.cast);
    expect(guests).toHaveLength(18); expect(new Set(guests.map((guest) => guest.id)).size).toBe(18);
    for (const guest of guests) {
      expect(callerFormSchema.safeParse(guest.caller).success, guest.id).toBe(true);
      expect(guest.caller.hiddenTruth!.length).toBeGreaterThan(80);
      expect(guest.caller.suggestedQuestions!.split("\n")).toHaveLength(3);
      expect(guest.preview).toBeTruthy(); expect(guest.portrait.url).toMatch(/^data:image\/svg\+xml/);
    }
    for (const pack of human) { expect(new Set(pack.cast.map((guest) => guest.caller.voiceId)).size).toBe(6); expect(showIdentitySchema.safeParse(pack.identity).success).toBe(true); }
    expect(starterPacks.find((pack) => pack.mode === "auto")?.editorialStatus).toBe("awaiting-theme-and-cast");
  });
  it("keeps counts and enabled media defaults consistent", () => {
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
    expect(starterPackMenu[0].guests).toHaveLength(6);
    for (const guest of starterPacks[0].cast) expect(JSON.stringify(starterPackMenu)).not.toContain(guest.caller.hiddenTruth);
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
