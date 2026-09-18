import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), caller: vi.fn(), show: vi.fn(), queue: vi.fn(), hangup: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdminSession: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { caller: { findUnique: mocks.caller }, show: { findUnique: mocks.show }, queueItem: { findUnique: mocks.queue } } }));
vi.mock("@/lib/openai-live-close", () => ({ createLiveCloseToken: () => "signed", hangupOpenAILiveSession: mocks.hangup }));
import { POST } from "@/app/api/openai-live/call/route";

const request = (body: unknown) => new Request("http://localhost/api/openai-live/call", { method: "POST", body: JSON.stringify(body) });
const input = { showId: "show", callerId: "caller", sdp: "v=0", testMode: true };
describe("GPT-Live session endpoint boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("OPENAI_API_KEY", "private-test-key");
    mocks.auth.mockResolvedValue(true); mocks.hangup.mockResolvedValue(true);
    mocks.caller.mockResolvedValue({ id: "caller", firstName: "Robin", character: {}, story: {}, performance: { voiceId: "cedar" } });
    mocks.show.mockResolvedValue({ currentQueueItemId: "queued", title: "Show", brandingConfig: {} });
    mocks.queue.mockResolvedValue({ callerId: "caller" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ session: { id: "live_session" }, transport: { sdp: "answer" } }) })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("requires authentication before querying callers or contacting OpenAI", async () => {
    mocks.auth.mockResolvedValue(false);
    expect((await POST(request(input))).status).toBe(401);
    expect(mocks.caller).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards the browser SDP and provider answer unchanged, including final line endings", async () => {
    const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n";
    const answer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=setup:active\r\n";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ session: { id: "live_session" }, transport: { sdp: answer } }) })));
    const response = await POST(request({ ...input, sdp }));
    expect(response.status).toBe(200);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).transport.sdp).toBe(sdp);
    expect((await response.json()).sdp).toBe(answer);
  });
  it("isolates private auditions from shows and keeps permanent credentials server-side", async () => {
    const response = await POST(request({ ...input, previewVoice: "willow" }));
    const body = await response.json();
    expect(body).toMatchObject({ voice: "willow", sdp: "answer", closeToken: "signed" });
    expect(JSON.stringify(body)).not.toContain("private-test-key");
    expect(mocks.show).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/live/sessions");
    expect(JSON.parse(options?.body as string)).toMatchObject({ session: { store: false, audio: { output: { voice: "willow" } } }, transport: { type: "webrtc", sdp: "v=0" } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects a production audition override and inactive caller", async () => {
    expect((await POST(request({ ...input, testMode: false, previewVoice: "willow" }))).status).toBe(400);
    mocks.queue.mockResolvedValue({ callerId: "different" });
    expect((await POST(request({ ...input, testMode: false }))).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the stored voice for the active production caller", async () => {
    expect(await (await POST(request({ ...input, testMode: false }))).json()).toMatchObject({ voice: "cedar" });
    expect(mocks.show).toHaveBeenCalledOnce();
  });
  it("returns actionable access errors without leaking provider response details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "private-provider-detail" } }) })));
    const response = await POST(request(input));
    expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("private-provider-detail");
  });
  it("identifies a rejected WebRTC offer without blaming model selection or exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { code: "invalid_offer", message: "private-provider-detail" } }) })));
    const response = await POST(request(input));
    const { error } = await response.json();
    expect(error).toContain("WebRTC connection offer was rejected");
    expect(error).not.toContain("Check the model setting");
    expect(error).not.toContain("private-provider-detail");
  });
  it("hangs up sessions when their returned SDP is unusable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ session: { id: "live_session" }, transport: {} }) })));
    expect((await POST(request(input))).status).toBe(502);
    expect(mocks.hangup).toHaveBeenCalledWith("live_session");
  });
  it("hangs up a session created after the browser abandons its request", async () => {
    const controller = new AbortController(); controller.abort();
    const abandoned = new Request(request(input), { signal: controller.signal });
    expect((await POST(abandoned)).status).toBe(499);
    expect(mocks.hangup).toHaveBeenCalledWith("live_session");
  });
});
