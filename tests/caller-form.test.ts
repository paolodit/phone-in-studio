import { describe, expect, it } from "vitest";
import { callerStructuredData } from "@/lib/caller";
import { callerFormSchema } from "@/lib/schemas";

describe("simplified caller form", () => {
  it("creates a usable caller from the on-air essentials alone", () => {
    const form = callerFormSchema.parse({
      firstName: "Ruth",
      location: "Carlisle",
      issueHeadline: "I value one afternoon when nobody knows me.",
      openingSummary: "Ruth enjoys a weekly café trip alone and wants her family to understand that chosen solitude is not loneliness.",
    });
    const structured = callerStructuredData(form);
    expect(structured.character.centralWant).toContain("genuine conversation");
    expect(structured.character.comicContradiction).toBe("");
    expect(structured.story.hiddenTruth).toBe("");
    expect(structured.story.escalationBeats).toEqual([]);
    expect(structured.performance.voiceId).toBe("marin");
  });
});
