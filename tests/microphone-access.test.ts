import { describe, expect, it } from "vitest";
import { microphoneAccessIssue } from "@/lib/voice/openai-webrtc-provider";

describe("browser microphone readiness", () => {
  it("explains why an insecure browser address cannot start a live caller", () => {
    expect(microphoneAccessIssue({ isSecureContext: false, hasGetUserMedia: false, origin: "http://192.168.1.20:3000" })).toContain("localhost:3000");
  });

  it("allows a secure browser with getUserMedia", () => {
    expect(microphoneAccessIssue({ isSecureContext: true, hasGetUserMedia: true })).toBeNull();
  });
});
