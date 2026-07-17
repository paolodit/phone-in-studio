import { describe, expect, it } from "vitest";
import { resolveOpenAIVoice, voiceMatchesPresentation } from "@/lib/voices";

describe("voice presentation matching", () => {
  it("keeps a specifically selected voice when its presentation matches", () => {
    expect(resolveOpenAIVoice("coral", "feminine")).toBe("coral");
    expect(resolveOpenAIVoice("cedar", "masculine")).toBe("cedar");
  });

  it("uses a safe provider default when the selected voice conflicts", () => {
    expect(resolveOpenAIVoice("cedar", "feminine")).toBe("marin");
    expect(resolveOpenAIVoice("coral", "masculine")).toBe("cedar");
    expect(resolveOpenAIVoice("coral", "neutral")).toBe("alloy");
  });

  it("leaves legacy callers unchanged when no preference is stored", () => {
    expect(resolveOpenAIVoice("mock-gravel-welsh")).toBe("echo");
    expect(voiceMatchesPresentation("echo", "any")).toBe(true);
  });
});
