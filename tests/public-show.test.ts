import { describe, expect, it } from "vitest";
import { publicCallerFromSnapshot } from "@/lib/public-show";

describe("broadcast privacy boundary", () => {
  it("allow-lists public fields and excludes private caller material", () => {
    const result = publicCallerFromSnapshot({
      callerId: "caller-1", publicIdentity: { firstName: "Mandy", location: "Bridgend", occupation: "Accounts assistant" }, publicPremise: { issueHeadline: "The fridge is biased", openingSummary: "It likes her husband." },
      character: { comicContradiction: "She made him admin", secret: "never public" }, story: { hiddenTruth: "She forgot the password" }, performance: { voiceId: "mock" }, hostSupport: { rescueQuestions: ["Why?"] },
      assets: [{ id: "asset-1", type: "PORTRAIT", label: "Mandy", url: "/mandy.svg", priority: 0 }, { id: "asset-2", type: "SUPPORTING_VISUAL", label: "Fridge screen", url: "/fridge.svg", priority: 1 }],
    }, "asset-2");
    const serialized = JSON.stringify(result);
    expect(result).toMatchObject({ name: "Mandy", location: "Bridgend", issueHeadline: "The fridge is biased" });
    expect(result?.visual).toEqual({ label: "Fridge screen", url: "/fridge.svg" });
    expect(serialized).not.toContain("forgot the password");
    expect(serialized).not.toContain("made him admin");
    expect(serialized).not.toContain("rescueQuestions");
  });
});
