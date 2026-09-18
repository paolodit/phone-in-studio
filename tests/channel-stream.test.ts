import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({ exists: vi.fn(), admin: vi.fn(), token: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { findUnique: mocks.exists } } }));
vi.mock("@/lib/auth", () => ({ isAdminSession: mocks.admin }));
vi.mock("@/lib/show-service", () => ({ canViewBroadcast: mocks.token, getBroadcastSnapshot: mocks.snapshot }));
import { GET } from "@/app/api/shows/[showId]/events/route";

const get = () => GET(new Request("http://localhost/api/shows/test/events?token=old-link"), { params: Promise.resolve({ showId: "test" }) });
describe("deleted-channel display recovery", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.exists.mockResolvedValue({ id: "test" }); mocks.admin.mockResolvedValue(true); });
  it("clears a stale broadcast on reconnect after the deletion event was missed", async () => {
    mocks.exists.mockResolvedValue(null);
    const response = await get();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toBe("event: deleted\ndata: {}\n\n");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("does not expose an existing channel to an unauthorised viewer", async () => {
    mocks.admin.mockResolvedValue(false); mocks.token.mockResolvedValue(false);
    expect((await get()).status).toBe(401); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("handles deletion between the existence check and snapshot load", async () => {
    mocks.snapshot.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Gone", { code: "P2025", clientVersion: "test" }));
    expect(await (await get()).text()).toBe("event: deleted\ndata: {}\n\n");
  });
});
