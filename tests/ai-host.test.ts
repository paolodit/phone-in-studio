import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostProfile } from "@/generated/prisma/client";
import { generateHostTurn } from "@/lib/ai-host";
const profile = { name: "Maya", stylePreset: "gentle", characteristics: {}, active: true } as HostProfile;
describe("AI Host text generation", () => {
  beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-private"); vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("returns a short complete spoken line and does not store the conversation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "What happened next?" }] }] })));
    expect(await generateHostTurn({ profile, transcript: [] })).toBe("What happened next?");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ store: false, max_output_tokens: 512 });
  });
  it("reports empty or incomplete replies instead of attempting silent speech", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "incomplete", output: [] })));
    await expect(generateHostTurn({ profile, transcript: [] })).rejects.toThrow("cut short");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [] })));
    await expect(generateHostTurn({ profile, transcript: [] })).rejects.toThrow("no spoken reply");
  });
  it("rejects overlong output before handing it to voice adapters", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ output_text: "x".repeat(1001) })));
    await expect(generateHostTurn({ profile, transcript: [] })).rejects.toThrow("short spoken line");
  });
});
