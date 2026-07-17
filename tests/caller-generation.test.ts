import { describe, expect, it } from "vitest";
import { extractResponseText, generatedDraftToCallerForm } from "@/lib/caller-generation";
import { callerPremisesSchema, generatedCallerDraftSchema } from "@/lib/schemas";

const draft = {
  firstName: "Megan", surnameInitial: "R", age: 38, location: "Newport", occupation: "Library assistant", relationshipStatus: "Co-parenting amicably",
  issueHeadline: "The book-swap shelf has a secret ranking system", openingSummary: "Megan believes the estate book-swap shelf is downgrading her taste after every donation.",
  centralWant: "To be recognised as the shelf's most discerning contributor.", worldview: "A community shelf needs standards, preferably hers.",
  actualBehaviour: "She has been quietly moving books she dislikes to the bottom shelf.", comicContradiction: "She blames the shelf's hierarchy while personally enforcing it.",
  speechStyle: "Precise, polite and increasingly offended by vague accusations.", hiddenTruth: "The shelf has no ranking system; the neighbours keep putting her old thrillers back on top because they are popular.",
  escalationBeats: ["She produces a colour-coded donation log.", "The host spots her own relocation notes.", "A neighbour's harmless reading preference becomes the decisive clue."],
  suggestedQuestions: ["Who decides where a donated book goes?", "Why does your log include other people's books?", "Could popularity explain the top shelf?"],
  voicePresentation: "feminine", voiceId: "marin", originalityNotes: "Keep the shelf rules and local details specific rather than resembling an existing sketch.",
  producerReviewNotes: ["Check the local details are fictional.", "Keep the host challenge warm rather than mocking."],
};

describe("Caller Workshop contracts", () => {
  it("validates six structured premise options", () => {
    const premise = { title: "Shelf government", setup: "A caller thinks a book-swap shelf has elected a ruling class.", callerPointOfView: "She wants the shelf to respect serious readers.", comicContradiction: "She has been moving other people's choices herself.", escalationPossibility: "Her handwritten audit gets increasingly elaborate.", hostChallenge: "Who authorised her to reorganise everyone else's books?", originalityWarning: "Vary the prop and local rules before production." };
    expect(callerPremisesSchema.parse({ premises: Array.from({ length: 6 }, (_, index) => ({ ...premise, title: `${premise.title} ${index + 1}` })) }).premises).toHaveLength(6);
  });

  it("turns a generated card into the existing draft form contract", () => {
    const parsed = generatedCallerDraftSchema.parse(draft);
    expect(generatedDraftToCallerForm(parsed)).toMatchObject({ firstName: "Megan", voicePresentation: "feminine", voiceId: "marin", escalationBeats: expect.stringContaining("colour-coded") });
  });

  it("extracts structured text from the REST Responses shape", () => {
    expect(extractResponseText({ output: [{ type: "message", content: [{ type: "output_text", text: '{"premises":[]}' }] }] })).toBe('{"premises":[]}');
  });
});
