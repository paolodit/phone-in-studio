import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), find: vi.fn(), store: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdminSession: mocks.admin }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { findUnique: mocks.find } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/show-identity-service", () => ({ saveShowIdentity: mocks.save }));
vi.mock("@/lib/show-artwork-store", async (original) => ({ ...await original<typeof import("@/lib/show-artwork-store")>(), storeArtwork: mocks.store }));
import { POST, PUT } from "@/app/api/shows/[showId]/artwork/route";
import { defaultShowIdentity } from "@/lib/show-identity";
const context = { params: Promise.resolve({ showId: "show" }) };
const url = "http://localhost:3000/api/shows/show/artwork";
describe("artwork API access and request boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue(true); mocks.find.mockResolvedValue({ id: "show" }); mocks.store.mockResolvedValue(`/api/show-artwork/${"a".repeat(64)}.webp`); mocks.save.mockImplementation(async (_, identity) => identity); });
  it("requires an admin session before processing images or identity", async () => {
    mocks.admin.mockResolvedValue(false);
    expect((await POST(new Request(url, { method: "POST", body: "test" }), context)).status).toBe(401);
    expect((await PUT(new Request(url, { method: "PUT", body: "{}" }), context)).status).toBe(401);
    expect(mocks.store).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and deleted channels", async () => {
    expect((await POST(new Request(url, { method: "POST", headers: { Origin: "https://example.com" } }), context)).status).toBe(403);
    mocks.find.mockResolvedValue(null);
    expect((await POST(new Request(url, { method: "POST" }), context)).status).toBe(404);
  });
  it("rejects unsupported file types and oversized streamed uploads", async () => {
    expect((await POST(new Request(url, { method: "POST", headers: { "Content-Type": "image/svg+xml" }, body: "<svg/>" }), context)).status).toBe(415);
    expect((await POST(new Request(url, { method: "POST", headers: { "Content-Type": "image/png", "Content-Length": String(6 * 1024 * 1024) }, body: "test" }), context)).status).toBe(400);
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("uploads into a preview without automatically changing channel settings", async () => {
    const response = await POST(new Request(url, { method: "POST", headers: { "Content-Type": "image/png" }, body: "test image bytes" }), context);
    expect(response.status).toBe(200); expect(await response.json()).toHaveProperty("artworkUrl"); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("accepts the configured HTTPS origin behind an internal HTTP proxy", async () => {
    vi.stubEnv("STUDIO_PUBLIC_URL", "https://studio.example.com");
    const response = await POST(new Request(url, { method: "POST", headers: { Origin: "https://studio.example.com", "Content-Type": "image/png" }, body: "image" }), context);
    expect(response.status).toBe(200);
  });
  it("does not trust forwarded headers to override the configured origin", async () => {
    vi.stubEnv("STUDIO_PUBLIC_URL", "https://studio.example.com");
    const response = await POST(new Request(url, { method: "POST", headers: { Origin: "https://other.example.com", "X-Forwarded-Host": "other.example.com", "X-Forwarded-Proto": "https", "Content-Type": "image/png" }, body: "image" }), context);
    expect(response.status).toBe(403);
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("saves only through the identity validator and refreshes the app", async () => {
    const identity = defaultShowIdentity("Test");
    const response = await PUT(new Request(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(identity) }), context);
    expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith("show", identity); expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
});
