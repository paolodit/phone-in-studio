import { z } from "zod";

const optionalText = z.string().trim().optional().transform((value) => value || undefined);

export const callerFormSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  surnameInitial: optionalText,
  age: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().min(18).max(120).optional()),
  location: z.string().trim().min(1).max(120),
  occupation: optionalText,
  relationshipStatus: optionalText,
  issueHeadline: z.string().trim().min(5).max(180),
  openingSummary: z.string().trim().min(10).max(1_000),
  centralWant: z.string().trim().max(500).optional().default(""),
  worldview: z.string().trim().max(500).optional().default(""),
  actualBehaviour: z.string().trim().max(500).optional().default(""),
  comicContradiction: z.string().trim().max(500).optional().default(""),
  speechStyle: z.string().trim().max(500).optional().default(""),
  hiddenTruth: z.string().trim().max(1_000).optional().default(""),
  escalationBeats: z.string().trim().max(2_000).optional().default(""),
  suggestedQuestions: z.string().trim().max(2_000).optional().default(""),
  topicTags: z.string().trim().max(320).optional().default(""),
  voicePresentation: z.enum(["any", "feminine", "masculine", "neutral"]).optional(),
  voiceId: z.string().trim().min(1).max(120).optional().default("marin"),
  elevenLabsVoiceId: optionalText,
  pacing: z.enum(["Measured", "Conversational", "Brisk", "Animated"]).optional(),
  portraitUrl: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
});

export type CallerFormInput = z.infer<typeof callerFormSchema>;

export const callerIdeaSeedSchema = z.object({
  sourceNotes: z.string().trim().min(12, "Add a little more detail so the workshop has something to develop.").max(4_000),
  callType: z.enum(["auto", "advice", "opinion", "personal", "practical", "wildcard"]).optional().default("auto"),
  tone: z.enum(["auto", "grounded", "lively", "reflective", "strange"]).optional().default("auto"),
});

export type CallerIdeaSeed = z.infer<typeof callerIdeaSeedSchema>;

export const callerPremiseSchema = z.object({
  title: z.string().trim().min(3).max(100),
  setup: z.string().trim().min(12).max(600),
  callerPointOfView: z.string().trim().min(8).max(400),
  callMode: z.enum(["advice", "opinion", "personal story", "practical problem", "light/strange", "wildcard"]),
  emotionalStake: z.string().trim().min(8).max(400),
  internalTension: z.string().trim().min(3).max(400),
  hostRoute: z.string().trim().min(8).max(400),
  originalityNote: z.string().trim().min(8).max(400),
});

export type CallerPremise = z.infer<typeof callerPremiseSchema>;

export const callerPremisesSchema = z.object({
  premises: z.array(callerPremiseSchema).length(6),
});

export const generatedCallerDraftSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  surnameInitial: z.string().trim().max(1),
  age: z.number().int().min(18).max(120),
  location: z.string().trim().min(1).max(120),
  occupation: z.string().trim().min(2).max(120),
  relationshipStatus: z.string().trim().min(2).max(120),
  issueHeadline: z.string().trim().min(5).max(180),
  openingSummary: z.string().trim().min(10).max(1_000),
  desiredOutcome: z.string().trim().min(3).max(500),
  selfStory: z.string().trim().min(3).max(500),
  emotionalStake: z.string().trim().min(3).max(500),
  behaviour: z.string().trim().min(3).max(500),
  internalTension: z.string().trim().min(3).max(500),
  speechStyle: z.string().trim().min(3).max(500),
  withheldDetail: z.string().trim().max(1_000),
  developmentBeats: z.array(z.string().trim().min(3).max(500)).max(4),
  suggestedQuestions: z.array(z.string().trim().min(3).max(500)).min(3).max(5),
  callMode: z.enum(["advice", "opinion", "personal story", "practical problem", "light/strange", "wildcard"]),
  emotionalTemperature: z.enum(["low", "medium", "high"]),
  topicTags: z.array(z.string().trim().min(2).max(40)).max(6).optional().default([]),
  voicePresentation: z.enum(["feminine", "masculine", "neutral"]),
  voiceId: z.enum(["alloy", "ash", "ballad", "coral", "cedar", "echo", "marin", "sage", "shimmer", "verse"]),
  originalityNotes: z.string().trim().min(8).max(500),
  producerReviewNotes: z.array(z.string().trim().min(3).max(500)).min(1).max(5),
});

export type GeneratedCallerDraft = z.infer<typeof generatedCallerDraftSchema>;

export const generatedCallerSaveSchema = z.object({
  sourceNotes: callerIdeaSeedSchema.shape.sourceNotes,
  callType: callerIdeaSeedSchema.shape.callType,
  tone: callerIdeaSeedSchema.shape.tone,
  premise: callerPremiseSchema,
  draft: generatedCallerDraftSchema,
});

export const callerReviewSchema = z.object({
  producerNotes: z.string().trim().max(4_000).optional().transform((value) => value || undefined),
  fictionalRightsChecked: z.preprocess((value) => value === "on", z.boolean()),
  toneChecked: z.preprocess((value) => value === "on", z.boolean()),
  hostRouteChecked: z.preprocess((value) => value === "on", z.boolean()),
  technicalChecked: z.preprocess((value) => value === "on", z.boolean()),
});

export const queueControlSchema = z.object({
  action: z.enum([
    "START_SHOW",
    "CUE_NEXT",
    "ANSWER_CALL",
    "MOCK_CONNECT",
    "MOCK_SPEAK",
    "INTERRUPT_CALLER",
    "MUTE_CALLER",
    "UNMUTE_CALLER",
    "HOLD_CALLER",
    "RESUME_CALLER",
    "END_CALL",
    "CALLER_HANGS_UP",
    "SKIP_CALLER",
    "EMERGENCY_STOP",
    "END_SHOW",
  ]),
});

export type StudioControlAction = z.infer<typeof queueControlSchema>["action"];

export const queueReorderSchema = z.object({
  queueItemIds: z.array(z.string().min(1)).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, "Caller IDs must be unique."),
});

export const queueCallerSchema = z.object({
  callerId: z.string().min(1),
});

export const queueReactivateSchema = z.object({
  queueItemId: z.string().min(1),
});

export const audioLevelsSchema = z.object({
  level: z.number().min(0).max(1),
  bands: z.array(z.number().min(0).max(1)).length(12),
});

export const generatedImageSchema = z.object({
  prompt: z.string().trim().min(8).max(1_500),
  kind: z.enum(["portrait", "topic"]),
});

export const showSetupSchema = z.object({
  title: z.string().trim().min(3).max(120),
  formatId: z.enum(["general", "advice", "discussion", "stories", "sports", "competition", "entertainment"]),
  formatGuidance: z.string().trim().max(1_500).optional().transform((value) => value || undefined),
  voiceProvider: z.enum(["openai", "gemini", "elevenlabs"]),
});

export const realtimeSessionRequestSchema = z.object({
  showId: z.string().min(1),
  callerId: z.string().min(1),
  testMode: z.boolean().optional().default(false),
});

export const realtimeCallRequestSchema = realtimeSessionRequestSchema.extend({
  sdp: z.string().min(1).max(1_000_000),
});

export const transcriptEntrySchema = z.object({
  speaker: z.enum(["HOST", "CALLER", "SYSTEM"]),
  text: z.string().trim().min(1).max(4_000),
});

export const broadcastVisualSchema = z.object({
  assetId: z.string().min(1).nullable(),
});

export const callerAssetFormSchema = z.object({
  label: z.string().trim().min(2).max(120),
  url: z.string().url(),
  creditText: z.string().trim().max(160).optional().transform((value) => value || undefined),
  creditUrl: z.string().url().optional(),
  trigger: z.string().trim().max(400).optional().transform((value) => value || undefined),
  manualHotkey: z.string().trim().regex(/^[1-9]?$/, "Use a single key from 1 to 9.").optional().transform((value) => value || undefined),
});

export const soundEffectFormSchema = z.object({
  label: z.string().trim().min(2).max(80),
  url: z.string().url(),
  hotkey: z.string().trim().max(20).optional().transform((value) => value || undefined),
  volume: z.coerce.number().min(0).max(1).default(0.8),
  loop: z.preprocess((value) => value === "on", z.boolean()),
});

export const soundTriggerSchema = z.object({ soundEffectId: z.string().min(1) });

export const callerSnapshotSchema = z.object({
  callerId: z.string(),
  publicIdentity: z.object({
    firstName: z.string(),
    surnameInitial: z.string().optional(),
    age: z.number().int().optional(),
    location: z.string(),
    occupation: z.string().optional(),
    relationshipStatus: z.string().optional(),
  }),
  publicPremise: z.object({
    issueHeadline: z.string(),
    openingSummary: z.string(),
  }),
  character: z.record(z.string(), z.unknown()),
  story: z.record(z.string(), z.unknown()),
  performance: z.record(z.string(), z.unknown()),
  hostSupport: z.record(z.string(), z.unknown()),
  assets: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      url: z.string(),
      creditText: z.string().nullable().optional(),
      creditUrl: z.string().nullable().optional(),
      trigger: z.string().nullable().optional(),
      manualHotkey: z.string().nullable().optional(),
      priority: z.number(),
    }),
  ),
});

export type CallerSnapshot = z.infer<typeof callerSnapshotSchema>;

export const callerInstructionSchema = z.object({
  publicIdentity: z.object({ firstName: z.string(), location: z.string(), occupation: z.string().optional() }),
  publicPremise: z.object({ issueHeadline: z.string(), openingSummary: z.string() }),
  character: z.object({
    centralWant: z.string(),
    worldview: z.string(),
    selfImage: z.string(),
    actualBehaviour: z.string(),
    comicContradiction: z.string(),
    emotionalBaseline: z.string(),
    speechStyle: z.string(),
    vocabularyNotes: z.string(),
    defensivenessTriggers: z.array(z.string()),
  }),
  story: z.object({
    surfaceProblem: z.string(),
    factualTimeline: z.array(z.string()),
    suspiciousDetails: z.array(z.string()),
    hiddenTruth: z.string(),
    escalationBeats: z.array(z.string()),
    exitConditions: z.array(z.string()),
  }),
  performance: z.object({
    voiceId: z.string(),
    voiceInstructions: z.string(),
    pacing: z.string(),
    averageResponseLength: z.string(),
    interruptionBehaviour: z.string(),
  }),
  hostSupport: z.object({ suggestedQuestions: z.array(z.string()), challengePoints: z.array(z.string()) }),
});

export type CallerInstructionInput = z.infer<typeof callerInstructionSchema>;
