import { createHmac } from "node:crypto";
import type { Caller, CallerAsset } from "@/generated/prisma/client";
import { buildCallerInstructions } from "@/lib/prompt";

const supportedVoices = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeVoice(value: unknown) {
  return typeof value === "string" && supportedVoices.has(value) ? value : "marin";
}

export function buildRealtimeSessionConfig(caller: Caller & { assets?: CallerAsset[] }) {
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
  });

  const visualAssets = (caller.assets ?? []).filter((asset) => asset.type === "SUPPORTING_VISUAL");
  const visualTool = visualAssets.length ? [{
    type: "function",
    name: "show_caller_visual",
    description: "Show one prepared supporting visual only when its subject naturally arises. Never verbally announce this tool call.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        assetId: { type: "string", enum: visualAssets.map((asset) => asset.id), description: "The prepared asset to show." },
        reason: { type: "string", description: "Short internal reason tied to the conversation." },
      },
      required: ["assetId", "reason"],
    },
  }] : [];
  const safetyIdentifier = createHmac("sha256", process.env.AUTH_SECRET ?? "development-only").update(caller.id).digest("hex").slice(0, 24);
  return {
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
    instructions: `${instructions}${visualAssets.length ? `\n\n# Visual trigger tools\nPrepared assets:\n${visualAssets.map((asset) => `- ${asset.id}: ${asset.label}${asset.trigger ? ` — ${asset.trigger}` : ""}`).join("\n")}\nCall show_caller_visual only for a prepared asset when it is relevant. Do not mention the tool or graphic aloud.` : ""}`,
    // Realtime’s stable session configuration, passed into the server-created ephemeral session.
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        turn_detection: { type: "server_vad", create_response: true, interrupt_response: true, prefix_padding_ms: 300, silence_duration_ms: 450 },
      },
      output: { voice: safeVoice(performance.voiceId), speed: 1 },
    },
    max_output_tokens: 180,
    tools: visualTool,
    tracing: { workflow_name: "ai-phone-in", metadata: { safety_identifier: safetyIdentifier } },
  };
}
