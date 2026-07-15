import type { Caller, CallerAsset } from "@/generated/prisma/client";
import type { CallerFormInput, CallerSnapshot } from "@/lib/schemas";

const list = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

export function callerStructuredData(input: CallerFormInput) {
  return {
    character: {
      centralWant: input.centralWant,
      worldview: input.worldview,
      selfImage: "A fundamentally reasonable person.",
      actualBehaviour: input.actualBehaviour,
      comicContradiction: input.comicContradiction,
      emotionalBaseline: "Mildly aggrieved but trying to stay composed.",
      speechStyle: input.speechStyle,
      vocabularyNotes: "Use natural, specific language rather than generic assistant phrases or catchphrases.",
      confidenceLevel: 6,
      patienceLevel: 5,
      defensivenessTriggers: [input.comicContradiction],
      thingsTheyWillNeverAdmit: [input.hiddenTruth],
      recurringDetails: [],
    },
    story: {
      surfaceProblem: input.openingSummary,
      factualTimeline: [input.openingSummary],
      suspiciousDetails: [input.comicContradiction],
      hiddenTruth: input.hiddenTruth,
      escalationBeats: list(input.escalationBeats),
      possibleReveals: [input.hiddenTruth],
      exitConditions: ["The host ends the call.", "The hidden truth has been clearly exposed."],
    },
    performance: {
      voiceId: input.voiceId,
      elevenLabsVoiceId: input.elevenLabsVoiceId,
      voiceInstructions: input.speechStyle,
      pacing: input.pacing ?? "Conversational",
      averageResponseLength: "One to three sentences",
      interruptionBehaviour: "Stop immediately, acknowledge the interruption, then answer the new question.",
      emotionalRange: "Controlled annoyance through to defensive indignation.",
    },
    hostSupport: {
      suggestedQuestions: list(input.suggestedQuestions),
      challengePoints: [input.comicContradiction],
      rescueQuestions: ["What happened immediately before that?", "Why did you not mention that earlier?"],
      avoidTopics: [],
      ejectLine: "We are running out of time, but thank you for calling.",
    },
  };
}

export function createCallerSnapshot(caller: Caller & { assets: CallerAsset[] }): CallerSnapshot {
  return {
    callerId: caller.id,
    publicIdentity: {
      firstName: caller.firstName,
      ...(caller.surnameInitial ? { surnameInitial: caller.surnameInitial } : {}),
      ...(caller.age ? { age: caller.age } : {}),
      location: caller.location,
      ...(caller.occupation ? { occupation: caller.occupation } : {}),
      ...(caller.relationshipStatus ? { relationshipStatus: caller.relationshipStatus } : {}),
    },
    publicPremise: { issueHeadline: caller.issueHeadline, openingSummary: caller.openingSummary },
    character: caller.character as Record<string, unknown>,
    story: caller.story as Record<string, unknown>,
    performance: caller.performance as Record<string, unknown>,
    hostSupport: caller.hostSupport as Record<string, unknown>,
    assets: caller.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      label: asset.label,
      url: asset.url,
      creditText: asset.creditText,
      creditUrl: asset.creditUrl,
      trigger: asset.trigger,
      manualHotkey: asset.manualHotkey,
      priority: asset.priority,
    })),
  };
}
