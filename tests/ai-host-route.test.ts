import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), module: vi.fn(), showModule: vi.fn(), host: vi.fn(), show: vi.fn(), queue: vi.fn(), caller: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdminSession: mocks.auth }));
vi.mock("@/lib/modules", () => ({ moduleEnabled: mocks.module, showModuleEnabled: mocks.showModule }));
vi.mock("@/lib/ai-host", () => ({ generateHostTurn: mocks.generate }));
vi.mock("@/lib/prisma", () => ({ prisma: { hostProfile: { findUniqueOrThrow: mocks.host }, show: { findUniqueOrThrow: mocks.show }, queueItem: { findUnique: mocks.queue }, caller: { findUniqueOrThrow: mocks.caller } } }));
import { POST } from "@/app/api/ai-host/respond/route";
const request = (body: unknown) => new Request("http://localhost/api/ai-host/respond", { method: "POST", body: JSON.stringify(body) });
describe("AI Host enablement and live/test boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue(true); mocks.module.mockResolvedValue(true); mocks.showModule.mockResolvedValue(true);
    mocks.host.mockResolvedValue({ id: "host", active: true }); mocks.show.mockResolvedValue({ hostProfile: { id: "host", active: true }, hostMode: "AI_SUPERVISED", broadcastState: "CALLER_LIVE", currentQueueItemId: "queued" });
    mocks.queue.mockResolvedValue({ callerId: "caller", status: "LIVE" }); mocks.caller.mockResolvedValue({ id: "caller" }); mocks.generate.mockResolvedValue("What happened next?");
  });
  it("requires authentication and global enablement", async () => {
    mocks.auth.mockResolvedValue(false); expect((await POST(request({}))).status).toBe(401);
    mocks.auth.mockResolvedValue(true); mocks.module.mockResolvedValue(false);
    expect((await POST(request({ testMode: true, profileId: "host", transcript: [] }))).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("tests a presenter without touching any show or caller", async () => {
    expect((await POST(request({ testMode: true, profileId: "host", transcript: [] }))).status).toBe(200);
    expect(mocks.show).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.caller).not.toHaveBeenCalled();
  });
  it("requires show opt-in before generating a production response", async () => {
    mocks.showModule.mockResolvedValue(false);
    expect((await POST(request({ showId: "show", callerId: "caller", transcript: [] }))).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects a stale caller and a call on hold", async () => {
    mocks.queue.mockResolvedValue({ callerId: "next-caller", status: "LIVE" });
    expect((await POST(request({ showId: "show", callerId: "caller", transcript: [] }))).status).toBe(409);
    mocks.queue.mockResolvedValue({ callerId: "caller", status: "ON_HOLD" });
    expect((await POST(request({ showId: "show", callerId: "caller", transcript: [] }))).status).toBe(409);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("uses the assigned presenter for the actual live caller", async () => {
    expect(await (await POST(request({ showId: "show", callerId: "caller", transcript: [{ speaker: "CALLER", text: "Hello." }] }))).json()).toEqual({ text: "What happened next?", profileId: "host" });
  });
});
