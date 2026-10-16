import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), exists: vi.fn(), snapshot: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { findUniqueOrThrow: mocks.find, updateMany: mocks.update } } }));
vi.mock("@/lib/show-artwork-store", () => ({ artworkExists: mocks.exists }));
vi.mock("@/lib/show-service", () => ({ getBroadcastSnapshot: mocks.snapshot }));
vi.mock("@/lib/events", () => ({ publishShowUpdate: mocks.publish }));
import { saveShowIdentity } from "@/lib/show-identity-service";
import { defaultShowIdentity } from "@/lib/show-identity";
describe("saving channel identity", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.exists.mockResolvedValue(true); mocks.update.mockResolvedValue({ count: 1 });
    mocks.find.mockResolvedValue({ brandingConfig: { backgroundMusic: { enabled: true }, visualAutoplay: { enabled: true }, formatGuidance: "Keep this." }, updatedAt: new Date(0) });
    mocks.snapshot.mockResolvedValue({ showId: "show", title: "Test" });
  });
  it("changes only identity and publishes the new public snapshot", async () => {
    const identity = defaultShowIdentity("Test"); await saveShowIdentity("show", identity);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ where: { id: "show", updatedAt: new Date(0) }, data: { brandingConfig: { identity, backgroundMusic: { enabled: true }, visualAutoplay: { enabled: true }, formatGuidance: "Keep this." } } });
    expect(mocks.publish).toHaveBeenCalledWith("show", { showId: "show", title: "Test" });
  });
  it("re-reads and merges after a concurrent update; fails safely on repeated collisions", async () => {
    mocks.update.mockResolvedValueOnce({ count: 0 });
    await saveShowIdentity("show", defaultShowIdentity("Test")); expect(mocks.find).toHaveBeenCalledTimes(2);
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(saveShowIdentity("show", defaultShowIdentity("Test"))).rejects.toThrow("updated elsewhere");
  });
  it("does not save missing uploads or untrusted URL fields", async () => {
    mocks.exists.mockResolvedValue(false);
    await expect(saveShowIdentity("show", { ...defaultShowIdentity("Test"), artworkUrl: `/api/show-artwork/${"a".repeat(64)}.webp` })).rejects.toThrow("Upload");
    await expect(saveShowIdentity("show", { ...defaultShowIdentity("Test"), artworkUrl: "javascript:alert(1)" })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
