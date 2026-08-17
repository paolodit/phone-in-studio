import { describe, expect, it } from "vitest";
import { buildLiveDirectionInstructions, normalizeLiveDirection } from "@/lib/live-direction";

describe("live caller direction", () => {
  it("builds a provider-neutral instruction from the three host controls", () => {
    const instructions = buildLiveDirectionInstructions({ energy: 2, pace: -1, answerLength: -2 });
    expect(instructions).toContain("animated");
    expect(instructions).toContain("Slow your delivery");
    expect(instructions).toContain("one concise sentence");
    expect(instructions).toContain("Do not mention these controls");
  });

  it("clamps values to the supported five positions", () => {
    expect(normalizeLiveDirection({ energy: 9, pace: -8, answerLength: 0.4 })).toEqual({ energy: 2, pace: -2, answerLength: 0 });
  });
});
