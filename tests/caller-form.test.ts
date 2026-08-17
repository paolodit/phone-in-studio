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

  it("keeps a caller-specific Fish voice model ID optional", () => {
    const form = callerFormSchema.parse({
      firstName: "Owen",
      location: "Bristol",
      issueHeadline: "I made a spreadsheet to become more spontaneous.",
      openingSummary: "Owen bought a pottery wheel to loosen up, then built an elaborate planning system around it.",
      fishAudioVoiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
    });
    expect(callerStructuredData(form).performance.fishAudioVoiceId).toBe("802e3bc2b27e49c2995d23ef70e6ac89");
  });
});
