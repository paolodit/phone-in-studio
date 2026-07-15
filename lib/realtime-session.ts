import { createHmac } from "node:crypto";
import type { Caller, CallerAsset } from "@/generated/prisma/client";
import { buildCallerInstructions } from "@/lib/prompt";
import type { ShowFormatConfig } from "@/lib/show-format";

const supportedVoices = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);
const legacyVoiceAliases: Record<string, string> = {
  "mock-warm-welsh": "coral",
  "mock-dry-welsh": "cedar",
  "mock-confident-welsh": "shimmer",
  "mock-gravel-welsh": "echo",
  "mock-keen-welsh": "ash",
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeVoice(value: unknown) {
  if (typeof value !== "string") return "marin";
  const voice = legacyVoiceAliases[value] ?? value;
  return supportedVoices.has(voice) ? voice : "marin";
}

function speechSpeed(value: unknown) {
  const pacing = typeof value === "string" ? value.toLowerCase() : "";
  if (/(measured|thoughtful|slow|deliberate)/.test(pacing)) return 0.88;
  if (/(brisk|quick|fast|energetic|animated)/.test(pacing)) return 1.1;
  return 1;
}

export function buildRealtimeSessionConfig(caller: Caller & { assets?: CallerAsset[] }, showFormat?: Pick<ShowFormatConfig, "formatLabel" | "formatGuidance">) {
  const character = asRecord(caller.character);
  const story = asRecord(caller.story);
  const performance = asRecord(caller.performance);
  const hostSupport = asRecord(caller.hostSupport);
  const instructions = buildCallerInstructions({
    publicIdentity: { firstName: caller.firstName, location: caller.location, ...(caller.occupation ? { occupation: caller.occupation } : {}) },
    publicPremise: { issueHeadline: caller.issueHeadline, openingSummary: caller.openingSummary },
    character: {
      centralWant: String(character.centralWant ?? "Be heard by the host."),
      worldview: String(character.worldview ?? "The caller believes their complaint is reasonable."),
      selfImage: String(character.selfImage ?? "A reasonable person."),
      actualBehaviour: String(character.actualBehaviour ?? "They are partly responsible."),
      comicContradiction: String(character.comicContradiction ?? "Their account leaves out an important detail."),
      emotionalBaseline: String(character.emotionalBaseline ?? "Mildly aggrieved."),
      speechStyle: String(character.speechStyle ?? "Natural conversational speech."),
      vocabularyNotes: String(character.vocabularyNotes ?? "Use clear, specific language."),
      defensivenessTriggers: Array.isArray(character.defensivenessTriggers) ? character.defensivenessTriggers.map(String) : [],
    },
    story: {
      surfaceProblem: String(story.surfaceProblem ?? caller.openingSummary),
      factualTimeline: Array.isArray(story.factualTimeline) ? story.factualTimeline.map(String) : [],
      suspiciousDetails: Array.isArray(story.suspiciousDetails) ? story.suspiciousDetails.map(String) : [],
      hiddenTruth: String(story.hiddenTruth ?? "Keep the key detail private until pressure builds."),
      escalationBeats: Array.isArray(story.escalationBeats) ? story.escalationBeats.map(String) : [],
      exitConditions: Array.isArray(story.exitConditions) ? story.exitConditions.map(String) : ["The host ends the call."],
    },
    performance: {
      voiceId: String(performance.voiceId ?? "marin"),
      voiceInstructions: String(performance.voiceInstructions ?? "Natural speech."),
      pacing: String(performance.pacing ?? "Conversational"),
      averageResponseLength: String(performance.averageResponseLength ?? "One to three sentences"),
      interruptionBehaviour: String(performance.interruptionBehaviour ?? "Stop immediately and address the new question."),
    },
    hostSupport: {
      suggestedQuestions: Array.isArray(hostSupport.suggestedQuestions) ? hostSupport.suggestedQuestions.map(String) : [],
      challengePoints: Array.isArray(hostSupport.challengePoints) ? hostSupport.challengePoints.map(String) : [],
    },
  }, showFormat);

  const safetyIdentifier = createHmac("sha256", process.env.AUTH_SECRET ?? "development-only").update(caller.id).digest("hex").slice(0, 24);
  return {
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-1.5",
    instructions,
    // Realtime’s stable session configuration, passed into the server-created ephemeral session.
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        // Semantic VAD waits for a meaningful end-of-turn instead of treating
        // every short pause as a hand-off. High eagerness keeps replies quick.
        // Automatic barge-in stays off because incidental room noise can be
        // mistaken for speech and cancel a caller mid-answer; the host has a
        // deliberate Interrupt/Space control for reliable barge-in instead.
        turn_detection: { type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: false },
      },
      output: { voice: safeVoice(performance.voiceId), speed: speechSpeed(performance.pacing) },
    },
    max_output_tokens: 180,
    tracing: { workflow_name: "ai-phone-in", metadata: { safety_identifier: safetyIdentifier } },
  };
}
