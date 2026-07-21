import { describe, expect, it } from "vitest";
import { buildAutomatedVisualQuery, readAutomatedVisualConfig } from "@/lib/auto-visuals";
import { callerFactoryBatchSchema, showModuleSetupSchema } from "@/lib/schemas";

const batch = {
  title: "Late-night callers",
  seed: "Psychologically textured callers for a thoughtful late-night phone-in.",
  tone: "reflective",
  mix: "balanced",
  intensity: "medium",
};

describe("optional automation boundaries", () => {
  it("allows Caller Factory batches from 10 to 20 candidates", () => {
    expect(callerFactoryBatchSchema.parse({ ...batch, targetCount: 10 }).targetCount).toBe(10);
    expect(callerFactoryBatchSchema.parse({ ...batch, targetCount: 20 }).targetCount).toBe(20);
  });

  it("rejects batches outside the deliberately small range", () => {
    expect(callerFactoryBatchSchema.safeParse({ ...batch, targetCount: 9 }).success).toBe(false);
    expect(callerFactoryBatchSchema.safeParse({ ...batch, targetCount: 21 }).success).toBe(false);
  });

  it("accepts guarded autonomous host settings", () => {
    expect(showModuleSetupSchema.parse({
      aiHostEnabled: "on",
      callerFactoryEnabled: "on",
      hostMode: "AI_AUTONOMOUS",
      hostProfileId: "host-1",
      autoMaxTurns: "5",
      autoBetweenCallsSeconds: "4",
      autoVisualPolicy: "AUTO_SHOW",
      autoVisualAvoidPeople: "on",
    })).toMatchObject({ hostMode: "AI_AUTONOMOUS", autoMaxTurns: 5, autoBetweenCallsSeconds: 4, autoVisualPolicy: "AUTO_SHOW", autoVisualAvoidPeople: true });
  });

  it("defaults autonomous shows to credited visual auto-show preparation", () => {
    expect(readAutomatedVisualConfig({}, "AI_AUTONOMOUS")).toEqual({ policy: "AUTO_SHOW", avoidPeople: true });
    expect(buildAutomatedVisualQuery({ topicTags: ["work", "friendship"], issueHeadline: "I got the promotion my friend wanted" }, true)).toContain("no people");
  });
});
