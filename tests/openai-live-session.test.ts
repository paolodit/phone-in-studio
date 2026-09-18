import { afterEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/generated/prisma/client";
import { buildOpenAILiveSessionConfig } from "@/lib/openai-live-session";
import { OPENAI_LIVE_VOICE_OPTIONS, resolveOpenAILiveVoice } from "@/lib/openai-live-voices";
import { callerFormSchema, openaiLiveCallRequestSchema } from "@/lib/schemas";
import { callerStructuredData } from "@/lib/caller";
import { buildShowFormatConfig, readShowFormatConfig } from "@/lib/show-format";
import { createLiveCloseToken, readLiveCloseToken } from "@/lib/openai-live-close";

const caller = { id: "sample", firstName: "Ellie", location: "Cardiff", occupation: "Designer", issueHeadline: "The Netflix account is all we still share", openingSummary: "She wants to move on without losing an old friendship.", character: { centralWant: "Move on", speechStyle: "Warm and thoughtful" }, story: { hiddenTruth: "She still checks what her friend watches." }, performance: { voiceId: "coral", voicePresentation: "feminine" } } as unknown as Caller;
afterEach(() => vi.unstubAllEnvs());

describe("GPT-Live configuration and casting", () => {
  it("preserves SDP bytes including the final CRLF", () => {
    const sdp = "v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n";
    const parsed = openaiLiveCallRequestSchema.parse({ showId: "test", callerId: "caller", testMode: true, sdp });
    expect(parsed.sdp).toBe(sdp);
    expect(Buffer.from(parsed.sdp)).toEqual(Buffer.from(sdp));
  });
  it("rejects blank and oversized SDP without normalising valid offers", () => {
    for (const sdp of ["", " \r\n\t ", "x".repeat(65_537)]) {
      expect(openaiLiveCallRequestSchema.safeParse({ showId: "test", callerId: "caller", testMode: true, sdp }).success).toBe(false);
    }
  });
  it("keeps Realtime separate and exposes the new show route", () => {
    const format = buildShowFormatConfig({ title: "Phone-in", voiceProvider: "openai-live" });
    expect(readShowFormatConfig(format, "Fallback").voiceProvider).toBe("openai-live");
    expect(readShowFormatConfig({}, "Old show").voiceProvider).toBe("openai");
  });
  it("uses the Live endpoint contract, compact caller prompt, private storage and restricted events", () => {
    vi.stubEnv("OPENAI_LIVE_MODEL", "");
    const config = buildOpenAILiveSessionConfig(caller);
    expect(config.model).toBe("gpt-live-1");
    expect(config.audio).toEqual({ output: { voice: "coral" } });
    expect(config.store).toBe(false);
    expect(config.instructions).toContain("Netflix");
    expect(config.instructions).toContain("Backchannel policy:");
    expect(config.instructions).not.toContain("Stop output immediately");
    expect(JSON.stringify(config)).not.toMatch(/semantic_vad|turn_detection|max_output_tokens|OPENAI_API_KEY/);
    expect(config.client.data_channel.allowed_client_events).not.toContain("response.create");
  });
  it("provides 22 distinct supported voices, including the 12 new regional options", () => {
    expect(OPENAI_LIVE_VOICE_OPTIONS).toHaveLength(22);
    expect(new Set(OPENAI_LIVE_VOICE_OPTIONS.map((voice) => voice.id)).size).toBe(22);
    expect(resolveOpenAILiveVoice({ voiceId: "coral", voicePresentation: "feminine", openaiLiveVoiceId: "willow" })).toBe("willow");
    expect(resolveOpenAILiveVoice({ voiceId: "cedar", voicePresentation: "masculine", openaiLiveVoiceId: "vesper" })).toBe("vesper");
  });
  it("preserves distinct legacy casting and prevents gender mismatch in stored choices", () => {
    expect(resolveOpenAILiveVoice({ voiceId: "mock-gravel-welsh" })).toBe("echo");
    expect(resolveOpenAILiveVoice({ voiceId: "sage", voicePresentation: "feminine", openaiLiveVoiceId: "stone" })).toBe("sage");
    expect(resolveOpenAILiveVoice({ voiceId: "cedar", voicePresentation: "feminine" })).toBe("marin");
    expect(resolveOpenAILiveVoice({ voiceId: "alloy", voicePresentation: "neutral" })).toBe("alloy");
    expect(resolveOpenAILiveVoice({ openaiLiveVoiceId: "willow", voicePresentation: "any" })).toBe("willow");
  });
  it("allows a temporary audition without overwriting production casting", () => {
    const performance = { voiceId: "cedar", voicePresentation: "masculine", openaiLiveVoiceId: "vesper" };
    expect(resolveOpenAILiveVoice(performance, "willow")).toBe("willow");
    expect(resolveOpenAILiveVoice(performance)).toBe("vesper");
    const request = { showId: "test", callerId: "caller", sdp: "v=0", previewVoice: "willow" };
    expect(openaiLiveCallRequestSchema.safeParse({ ...request, testMode: true }).success).toBe(true);
    expect(openaiLiveCallRequestSchema.safeParse({ ...request, testMode: false }).success).toBe(false);
    expect(openaiLiveCallRequestSchema.safeParse({ ...request, previewVoice: "invented", testMode: true }).success).toBe(false);
  });
  it("round-trips optional voice selection through caller management", () => {
    const input = callerFormSchema.parse({ firstName: "Ellie", location: "Cardiff", issueHeadline: "A shared Netflix account", openingSummary: "A friendship is changing and she wants advice.", openaiLiveVoiceId: "willow" });
    expect(callerStructuredData(input).performance.openaiLiveVoiceId).toBe("willow");
    expect(callerFormSchema.safeParse({ ...input, openaiLiveVoiceId: "not-a-voice" }).success).toBe(false);
  });
  it("bounds old imported story notes without dropping the caller identity", () => {
    const config = buildOpenAILiveSessionConfig({ ...caller, openingSummary: "x".repeat(50_000), character: { speechStyle: "y".repeat(50_000) } });
    expect(config.instructions.length).toBeLessThan(6000);
    expect(config.instructions).toContain("Ellie");
  });
  it("only closes sessions covered by a valid, unexpired signed token", () => {
    vi.stubEnv("AUTH_SECRET", "test-only-secret");
    const token = createLiveCloseToken("live_with_original_prefix", 100);
    expect(readLiveCloseToken(token, 101)).toBe("live_with_original_prefix");
    expect(readLiveCloseToken(`${token}x`, 101)).toBeNull();
    expect(readLiveCloseToken(token, 100 + 12 * 60 * 60 * 1000)).toBeNull();
    expect(readLiveCloseToken("arbitrary.session.id", 101)).toBeNull();
  });
});
