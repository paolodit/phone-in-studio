import { describe, expect, it } from "vitest";
import type { Caller } from "@/generated/prisma/client";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";

describe("Realtime caller session configuration", () => {
  it("converts structured caller fields into a short, audio-only session without exposing an API key", () => {
    const caller = {
      id: "caller-1", firstName: "Mandy", surnameInitial: "P", age: null, location: "Bridgend", occupation: "Accounts assistant", relationshipStatus: null,
      issueHeadline: "The fridge has favourites", openingSummary: "The fridge supports her husband.", status: "APPROVED",
      character: { centralWant: "Be believed", worldview: "Fridges should be loyal", selfImage: "Reasonable", actualBehaviour: "Forgot passwords", comicContradiction: "Made him admin", emotionalBaseline: "Aggrieved", speechStyle: "Warm", vocabularyNotes: "Specific", defensivenessTriggers: ["admin"] },
      story: { surfaceProblem: "Fridge bias", factualTimeline: [], suspiciousDetails: ["admin"], hiddenTruth: "She made him admin", escalationBeats: ["Reveal setting"], exitConditions: ["Host ends call"] },
      performance: { voiceId: "not-a-valid-voice", voiceInstructions: "Natural", pacing: "Conversational", averageResponseLength: "short", interruptionBehaviour: "Stop" },
      hostSupport: { suggestedQuestions: ["Who is admin?"], challengePoints: ["You chose it"] }, generation: null, quality: null, rehearsalCount: 0, producerNotes: null, approvedAt: null, approvedBy: null, createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Caller;
    const config = buildRealtimeSessionConfig(caller);
    expect(config.output_modalities).toEqual(["audio"]);
    expect(config.audio.output.voice).toBe("marin");
    expect(config.instructions).toContain("Stop output immediately");
    expect(JSON.stringify(config)).not.toContain("OPENAI_API_KEY");
  });

  it("maps legacy seeded voice labels to distinct supported voices and honours pace", () => {
    const caller = {
      id: "caller-2", firstName: "Gareth", surnameInitial: "D", age: null, location: "Neath", occupation: null, relationshipStatus: null,
      issueHeadline: "A seagull knows my lunch break", openingSummary: "A seagull waits near the van.", status: "APPROVED",
      character: {}, story: {}, performance: { voiceId: "mock-dry-welsh", pacing: "Brisk" }, hostSupport: {}, generation: null, quality: null, rehearsalCount: 0, producerNotes: null, approvedAt: null, approvedBy: null, createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Caller;
    const config = buildRealtimeSessionConfig(caller);
    expect(config.audio.output.voice).toBe("cedar");
    expect(config.audio.output.speed).toBe(1.1);
  });
});
