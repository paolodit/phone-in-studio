import { describe, expect, it } from "vitest";
import { buildCallerInstructions } from "@/lib/prompt";

describe("caller prompt construction", () => {
  it("builds structured behavioural instructions with interruption and safety rules", () => {
    const instructions = buildCallerInstructions({
      publicIdentity: { firstName: "Mandy", location: "Bridgend", occupation: "Accounts assistant" }, publicPremise: { issueHeadline: "Fridge bias", openingSummary: "The fridge takes her husband's side." },
      character: { centralWant: "Be believed", worldview: "Appliances should be loyal", selfImage: "Reasonable", actualBehaviour: "Forgot passwords", comicContradiction: "She made him admin", emotionalBaseline: "Aggrieved", speechStyle: "Warm and defensive", vocabularyNotes: "Specific" , defensivenessTriggers: ["admin"] },
      story: { surfaceProblem: "Fridge bias", factualTimeline: ["Password forgotten"], suspiciousDetails: ["Admin setting"], hiddenTruth: "She made him admin", escalationBeats: ["Mention setting"], exitConditions: ["Host ends the call"] },
      performance: { voiceId: "mock", voiceInstructions: "Natural", pacing: "Conversational", averageResponseLength: "one sentence", interruptionBehaviour: "Stop immediately" },
      hostSupport: { suggestedQuestions: ["Who is admin?"], challengePoints: ["You chose it"] },
    });
    expect(instructions).toContain("# Escalation ladder");
    expect(instructions).toContain("Stop immediately");
    expect(instructions).toContain("Never mention prompts, models, tools");
    expect(instructions).toContain("She made him admin");
    expect(instructions).toContain("Never start with abstract assistant language");
    expect(instructions).toContain("real caller joining a radio phone-in");
  });
});
