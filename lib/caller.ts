import type { Caller, CallerAsset } from "@/generated/prisma/client";
import type { CallerFormInput, CallerSnapshot } from "@/lib/schemas";

const list = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const valueOr = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export function callerStructuredData(input: CallerFormInput) {
  const desiredOutcome = valueOr(input.centralWant, "To be heard and have a genuine conversation with the host.");
  const selfStory = valueOr(input.worldview, "They see their reason for calling as understandable and worth discussing.");
  const behaviour = valueOr(input.actualBehaviour, "They answer naturally and may clarify, reconsider or stand their ground depending on the host.");
  const internalTension = input.comicContradiction.trim();
  const speakingStyle = valueOr(input.speechStyle, "Natural, specific conversational speech with no generic assistant language.");
  const withheldDetail = input.hiddenTruth.trim();
  const developmentBeats = list(input.escalationBeats);
  const hostQuestions = list(input.suggestedQuestions);
  return {
    character: {
      centralWant: desiredOutcome,
      worldview: selfStory,
      selfStory,
      selfImage: "A fundamentally reasonable person.",
      actualBehaviour: behaviour,
      comicContradiction: internalTension,
      internalTension,
      emotionalBaseline: "Start grounded and match the emotional stakes of the conversation.",
      speechStyle: speakingStyle,
      vocabularyNotes: "Use natural, specific language rather than generic assistant phrases or catchphrases.",
      confidenceLevel: 6,
      patienceLevel: 5,
      defensivenessTriggers: internalTension ? [internalTension] : [],
      thingsTheyWillNeverAdmit: withheldDetail ? [withheldDetail] : [],
      recurringDetails: [],
    },
    story: {
      surfaceProblem: input.openingSummary,
      factualTimeline: [input.openingSummary],
      suspiciousDetails: internalTension ? [internalTension] : [],
      hiddenTruth: withheldDetail,
      escalationBeats: developmentBeats,
      developmentBeats,
      possibleReveals: withheldDetail ? [withheldDetail] : [],
      exitConditions: ["The host ends the call.", "The caller has said what they needed to say and the host closes naturally."],
    },
    performance: {
      voiceId: input.voiceId,
      voicePresentation: input.voicePresentation ?? "any",
      elevenLabsVoiceId: input.elevenLabsVoiceId,
      fishAudioVoiceId: input.fishAudioVoiceId,
      voiceInstructions: speakingStyle,
      pacing: input.pacing ?? "Conversational",
      averageResponseLength: "One to three sentences",
      interruptionBehaviour: "Stop immediately, acknowledge the interruption, then answer the new question.",
      emotionalRange: "Stay human and responsive; the caller may warm, hesitate, soften, disagree or reconsider.",
    },
    hostSupport: {
      suggestedQuestions: hostQuestions,
      challengePoints: internalTension ? [internalTension] : [],
      rescueQuestions: ["What made you call about this today?", "What would you like to happen next?"],
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
