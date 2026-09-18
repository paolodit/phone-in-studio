import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StarterPack } from "@/lib/starter-packs";

const mocks = vi.hoisted(() => ({ packs: [] as StarterPack[], show: vi.fn(), caller: vi.fn(), queue: vi.fn(), host: vi.fn(), module: vi.fn(), tx: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/starter-packs", async (original) => ({ ...await original<typeof import("@/lib/starter-packs")>(), starterPacks: mocks.packs }));
vi.mock("@/lib/stock-images", () => ({ searchStockImages: mocks.search }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { create: mocks.show }, $transaction: mocks.tx } }));
import { createChannel } from "@/lib/channel-creation";
import { starterPacks } from "@/lib/starter-packs";
import { demoCallerFixtures } from "@/lib/demo-callers";

async function fixture(mode: "human" | "auto" = "human") {
  const real = await vi.importActual<typeof import("@/lib/starter-packs")>("@/lib/starter-packs");
  return {
    ...structuredClone(real.starterPacks[0]), id: `test-${mode}`, mode, editorialStatus: "ready" as const, expectedGuests: (mode === "human" ? 6 : 5) as 6 | 5,
    cast: demoCallerFixtures.slice(0, mode === "human" ? 6 : 5).map((caller) => ({ id: caller.fixtureId, caller: { ...caller, portraitUrl: undefined }, portrait: { url: caller.portrait, label: "Portrait" }, imagery: { query: caller.topicTags } })),
    ...(mode === "auto" ? { presenter: { name: "Test host", publicIdentity: "Presenter", voiceId: "nova", stylePreset: "gentle", guidance: "Listen.", boundaries: "Stay fictional.", characteristics: { warmth: 0, energy: 0, patience: 0, playfulness: 0 } } } : {}),
  } satisfies StarterPack;
}

describe("channel creation", () => {
  beforeEach(async () => {
    vi.clearAllMocks(); mocks.packs.splice(0, mocks.packs.length, await fixture(), await fixture("auto"));
    mocks.show.mockImplementation(async ({ data }) => ({ ...structuredClone(data), id: "new-channel" }));
    let count = 0;
    mocks.caller.mockImplementation(async ({ data }) => ({ ...structuredClone(data), id: `guest-${++count}`, assets: data.assets.create.map((asset: object, index: number) => ({ ...asset, id: `asset-${count}-${index}` })) }));
    mocks.host.mockResolvedValue({ id: "new-presenter" });
    mocks.tx.mockImplementation(async (run) => run({ show: { create: mocks.show }, caller: { create: mocks.caller }, queueItem: { create: mocks.queue }, hostProfile: { create: mocks.host }, optionalModuleSetting: { upsert: mocks.module } }));
    mocks.search.mockResolvedValue({ results: [{ imageUrl: "https://images.pexels.com/test.jpg", alt: "Test image", creator: "Test Photographer", provider: "pexels", sourceUrl: "https://www.pexels.com/photo/test/" }] });
  });
  it("preserves the blank custom setup without importing guests or enabling modules", async () => {
    const show = await createChannel({ title: "My own channel", mode: "custom" });
    expect(show).toMatchObject({ title: "My own channel" }); expect(mocks.caller).not.toHaveBeenCalled(); expect(mocks.search).not.toHaveBeenCalled(); expect(mocks.module).not.toHaveBeenCalled();
  });
  it("rejects pending, mismatched and unknown packs before provider requests or writes", async () => {
    mocks.packs[0].editorialStatus = "awaiting-cast";
    await expect(createChannel({ title: "Channel", mode: "human", packId: "test-human" })).rejects.toThrow("confirmed");
    await expect(createChannel({ title: "Channel", mode: "auto", packId: "test-human" })).rejects.toThrow("Choose");
    await expect(createChannel({ title: "Channel", mode: "human", packId: "unknown" })).rejects.toThrow("Choose");
    expect(mocks.tx).not.toHaveBeenCalled(); expect(mocks.search).not.toHaveBeenCalled();
  });
  it("copies all six guests, their snapshots, attribution and enabled defaults atomically", async () => {
    const show = await createChannel({ title: "My disputes", mode: "human", packId: "test-human" });
    expect(mocks.caller).toHaveBeenCalledTimes(6); expect(mocks.queue).toHaveBeenCalledTimes(6); expect(mocks.tx).toHaveBeenCalledTimes(1);
    expect(show).toMatchObject({ status: "READY", hostMode: "HUMAN", brandingConfig: { visualAutoplay: { enabled: true }, backgroundMusic: { enabled: true }, starterPack: { id: "test-human", version: 1, missingVisuals: 0 } } });
    const data = mocks.caller.mock.calls[0][0].data;
    expect(data.assets.create[1]).toMatchObject({ creditText: "Test Photographer · Pexels", creditUrl: "https://www.pexels.com/photo/test/" });
    expect(mocks.queue.mock.calls[0][0].data.callerSnapshot.assets[1].creditText).toBe("Test Photographer · Pexels");
    expect(mocks.module).not.toHaveBeenCalled();
    const config = show.brandingConfig as Record<string, unknown>;
    expect(config.formatGuidance).toContain("Every guest is independent");
    mocks.packs[0].defaults.music.volume = 0.9;
    expect((config.backgroundMusic as { volume: number }).volume).toBe(0.12);
  });
  it("creates five auto guests and a private presenter copy, opts in, but never starts broadcasting", async () => {
    const show = await createChannel({ title: "Automatic show", mode: "auto", packId: "test-auto" });
    expect(mocks.caller).toHaveBeenCalledTimes(5); expect(mocks.host).toHaveBeenCalledOnce(); expect(mocks.module).toHaveBeenCalledOnce();
    expect(show).toMatchObject({ status: "READY", hostMode: "AI_AUTONOMOUS", hostProfileId: "new-presenter", moduleSettings: { create: { key: "AI_HOST", enabled: true } } });
    expect(show.startedAt).toBeUndefined();
  });
  it("uses authored images without searching, preserves credit and handles stock outages", async () => {
    const pack = starterPacks[0];
    pack.cast[0].imagery.images = [{ url: "/portraits/aisha.svg", label: "Local fixture", creditText: "Existing library" }];
    mocks.search.mockRejectedValue(new Error("No stock key"));
    const show = await createChannel({ title: "Offline channel", mode: "human", packId: "test-human" });
    expect(mocks.search).toHaveBeenCalledTimes(5);
    expect(show.brandingConfig).toMatchObject({ starterPack: { missingVisuals: 5 } });
    expect(mocks.caller.mock.calls[0][0].data.assets.create[1]).toMatchObject({ creditText: "Existing library" });
    expect(mocks.caller.mock.calls[1][0].data.assets.create).toHaveLength(1);
  });
});
