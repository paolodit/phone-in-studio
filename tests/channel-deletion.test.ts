import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), remove: vi.fn(), plans: vi.fn(), tx: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.tx } }));
vi.mock("@/lib/events", () => ({ publishShowDeleted: mocks.publish }));
import { deleteChannel } from "@/lib/channel-deletion";

describe("channel deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.find.mockResolvedValue({ title: "My channel", status: "READY" }); mocks.remove.mockResolvedValue({ count: 1 });
    mocks.tx.mockImplementation(async (run) => run({ show: { findUnique: mocks.find, deleteMany: mocks.remove }, showPlan: { updateMany: mocks.plans } }));
  });
  it("requires the exact channel name", async () => {
    await expect(deleteChannel("show", "other channel")).rejects.toThrow("exactly"); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("blocks live channels and a race with start/rename", async () => {
    mocks.find.mockResolvedValueOnce({ title: "My channel", status: "LIVE" });
    await expect(deleteChannel("show", "My channel")).rejects.toThrow("End this show");
    mocks.remove.mockResolvedValue({ count: 0 });
    await expect(deleteChannel("show", "My channel")).rejects.toThrow("changed"); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("deletes only the selected non-live show, releases its plan and notifies existing tabs", async () => {
    await deleteChannel("show", "My channel");
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "show", title: "My channel", status: { not: "LIVE" } } });
    expect(mocks.plans).toHaveBeenCalledWith({ where: { acceptedShowId: "show" }, data: { acceptedShowId: null, revision: { increment: 1 } } });
    expect(mocks.publish).toHaveBeenCalledWith("show");
  });
  it("handles an already removed channel without another mutation", async () => {
    mocks.find.mockResolvedValue(null); await expect(deleteChannel("show", "My channel")).rejects.toThrow("already"); expect(mocks.remove).not.toHaveBeenCalled();
  });
});
