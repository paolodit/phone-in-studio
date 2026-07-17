import { z } from "zod";
import {
  callerIdeaSeedSchema,
  type CallerIdeaSeed,
  callerPremiseSchema,
  callerPremisesSchema,
  type CallerFormInput,
  type CallerPremise,
  generatedCallerDraftSchema,
  type GeneratedCallerDraft,
} from "@/lib/schemas";
import { resolveOpenAIVoice } from "@/lib/voices";

export const CALLER_WORKSHOP_PROMPT_VERSION = "2026-07-17.1";
const DEFAULT_CALLER_GENERATION_MODEL = "gpt-5.4-mini";

type JsonSchema = Record<string, unknown>;

const premiseItemJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    setup: { type: "string" },
    callerPointOfView: { type: "string" },
    callMode: { type: "string", enum: ["advice", "opinion", "personal story", "practical problem", "light/strange", "wildcard"] },
    emotionalStake: { type: "string" },
    internalTension: { type: "string" },
    hostRoute: { type: "string" },
    originalityNote: { type: "string" },
  },
  required: ["title", "setup", "callerPointOfView", "callMode", "emotionalStake", "internalTension", "hostRoute", "originalityNote"],
  additionalProperties: false,
};

const premisesJsonSchema: JsonSchema = {
  type: "object",
  properties: { premises: { type: "array", minItems: 6, maxItems: 6, items: premiseItemJsonSchema } },
  required: ["premises"],
  additionalProperties: false,
};

const callerDraftJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    firstName: { type: "string" }, surnameInitial: { type: "string" }, age: { type: "integer" }, location: { type: "string" },
    occupation: { type: "string" }, relationshipStatus: { type: "string" }, issueHeadline: { type: "string" }, openingSummary: { type: "string" },
    desiredOutcome: { type: "string" }, selfStory: { type: "string" }, emotionalStake: { type: "string" }, behaviour: { type: "string" }, internalTension: { type: "string" },
    speechStyle: { type: "string" }, withheldDetail: { type: "string" },
    developmentBeats: { type: "array", minItems: 0, maxItems: 4, items: { type: "string" } },
    suggestedQuestions: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    callMode: { type: "string", enum: ["advice", "opinion", "personal story", "practical problem", "light/strange", "wildcard"] },
    emotionalTemperature: { type: "string", enum: ["low", "medium", "high"] },
    topicTags: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    voicePresentation: { type: "string", enum: ["feminine", "masculine", "neutral"] },
    voiceId: { type: "string", enum: ["alloy", "ash", "ballad", "coral", "cedar", "echo", "marin", "sage", "shimmer", "verse"] },
    originalityNotes: { type: "string" }, producerReviewNotes: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
  },
  required: [
    "firstName", "surnameInitial", "age", "location", "occupation", "relationshipStatus", "issueHeadline", "openingSummary",
    "desiredOutcome", "selfStory", "emotionalStake", "behaviour", "internalTension", "speechStyle", "withheldDetail", "developmentBeats", "suggestedQuestions",
    "callMode", "emotionalTemperature",
    "topicTags", "voicePresentation", "voiceId", "originalityNotes", "producerReviewNotes",
  ],
  additionalProperties: false,
};

type OpenAiResponsePayload = {
  output_text?: unknown;
  output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown; refusal?: unknown }> }>;
};

export class CallerWorkshopError extends Error {
  constructor(message: string, readonly kind: "not_configured" | "provider" | "invalid_output") {
    super(message);
  }
}

export function extractResponseText(payload: OpenAiResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const output of payload.output ?? []) {
    if (output.type !== "message") continue;
    for (const item of output.content ?? []) {
      if (item.type === "refusal") throw new CallerWorkshopError("The model could not develop that seed. Try a different fictional premise.", "provider");
      if (item.type === "output_text" && typeof item.text === "string") return item.text;
    }
  }
  throw new CallerWorkshopError("The model returned no usable workshop draft. Please try again.", "invalid_output");
}

async function requestStructuredOutput<T>(options: {
  name: string;
  schema: JsonSchema;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  validate: (value: unknown) => T;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new CallerWorkshopError("Caller Workshop is not configured. Set OPENAI_API_KEY to enable it.", "not_configured");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CALLER_GENERATION_MODEL ?? DEFAULT_CALLER_GENERATION_MODEL,
        store: false,
        max_output_tokens: options.maxOutputTokens,
        instructions: options.instructions,
        input: options.input,
        text: { format: { type: "json_schema", name: options.name, strict: true, schema: options.schema } },
      }),
    });
  } catch {
    throw new CallerWorkshopError("Caller Workshop could not reach OpenAI. Please try again shortly.", "provider");
  }

  const payload = await response.json().catch(() => null) as OpenAiResponsePayload | null;
  if (!response.ok || !payload) throw new CallerWorkshopError("Caller Workshop could not produce a draft. Check the configured model and try again.", "provider");

  try {
    return options.validate(JSON.parse(extractResponseText(payload)));
  } catch (error) {
    if (error instanceof CallerWorkshopError) throw error;
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new CallerWorkshopError("Caller Workshop returned an invalid draft. Please try again.", "invalid_output");
    }
    throw error;
  }
}

function seedBrief(input: CallerIdeaSeed) {
  const type = input.callType === "auto" ? "Choose the most promising mix of call types." : `Bias the pack toward ${input.callType} calls.`;
  const tone = input.tone === "auto" ? "Vary the emotional tone." : `Keep the overall tone ${input.tone}.`;
  return `Producer seed notes:\n${input.sourceNotes}\n\nCreative preference: ${type} ${tone}`;
}

export async function generateCallerPremises(seed: string | CallerIdeaSeed) {
  const input = callerIdeaSeedSchema.parse(typeof seed === "string" ? { sourceNotes: seed } : seed);
  return requestStructuredOutput({
    name: "caller_premises",
    schema: premisesJsonSchema,
    maxOutputTokens: 2_000,
    instructions: [
      "You are a development editor for a fictional, adult UK phone-in and livestream production toolkit.",
      "Generate exactly six clearly different caller premise options from the producer's seed. Every caller must be wholly fictional and an adult.",
      "Do not use real people, real private individuals, brands, existing fictional characters, performers' styles, protected characteristics as material, slurs, cruelty, medical or legal allegations, criminal accusations, or traumatic subjects.",
      "Across an automatic pack, deliberately vary the modes: practical, reflective, opinion or dispute, personal story, light or strange, and wildcard. Do not force every idea into a joke or a twist.",
      "Give each option a clear reason to call, an emotional stake, a point of view, and an internal tension the host can explore without humiliating the caller. The tension may be uncertainty, mixed motives, social pressure, or a contradiction; it does not need to be a secret.",
      "The originality note should tell the producer what to vary or check before using the idea. Keep all fields concise and production-useful.",
    ].join(" "),
    input: seedBrief(input),
    validate: (value) => callerPremisesSchema.parse(value).premises,
  });
}

export async function developCallerFromPremise(seed: string | CallerIdeaSeed, premise: CallerPremise) {
  const input = callerIdeaSeedSchema.parse(typeof seed === "string" ? { sourceNotes: seed } : seed);
  const selectedPremise = callerPremiseSchema.parse(premise);
  return requestStructuredOutput({
    name: "caller_draft",
    schema: callerDraftJsonSchema,
    maxOutputTokens: 3_000,
    instructions: [
      "You are a development editor for a fictional, adult UK phone-in and livestream production toolkit.",
      "Turn the producer's seed and selected premise into one internally consistent caller card. It is a private production draft, never an approved or live caller.",
      "The caller must be wholly fictional and adult. Do not use real people, brands, existing fictional characters, performer styles, protected characteristics as material, slurs, cruelty, medical or legal allegations, criminal accusations, or traumatic subjects.",
      "Keep the scenario safe and reversible. Make the public summary playable and the host questions fair rather than cruel. The card should work for the format implied by the producer's seed; it is not limited to comedy.",
      "A withheld detail is optional. Use an empty string when the call is stronger without one. Development beats are also optional and may deepen, soften or redirect the conversation rather than escalating it. The caller may remain uncertain, reconsider, or leave without a neat resolution.",
      "Choose a perceived voicePresentation and a matching voiceId from the allowed options: feminine uses coral, marin, sage or shimmer; masculine uses ash, ballad, cedar, echo or verse; neutral uses alloy. This is a casting preference for the fictional caller, not material for jokes or stereotyping. Add one to six concise topicTags useful for filtering the caller library. Spread voices across callers over time rather than always choosing the same one. The producer review notes must identify checks a human should make before approval, including originality and tone.",
    ].join(" "),
    input: `${seedBrief(input)}\n\nSelected premise:\n${JSON.stringify(selectedPremise)}`,
    validate: (value) => generatedCallerDraftSchema.parse(value),
  });
}

export function generatedDraftToCallerForm(draft: GeneratedCallerDraft): CallerFormInput {
  return {
    firstName: draft.firstName,
    surnameInitial: draft.surnameInitial || undefined,
    age: draft.age,
    location: draft.location,
    occupation: draft.occupation,
    relationshipStatus: draft.relationshipStatus,
    issueHeadline: draft.issueHeadline,
    openingSummary: draft.openingSummary,
    centralWant: draft.desiredOutcome,
    worldview: draft.selfStory,
    actualBehaviour: draft.behaviour,
    comicContradiction: draft.internalTension,
    speechStyle: draft.speechStyle,
    hiddenTruth: draft.withheldDetail,
    escalationBeats: draft.developmentBeats.join("\n"),
    suggestedQuestions: draft.suggestedQuestions.join("\n"),
    topicTags: draft.topicTags.join(", "),
    voicePresentation: draft.voicePresentation,
    voiceId: resolveOpenAIVoice(draft.voiceId, draft.voicePresentation),
    elevenLabsVoiceId: undefined,
    portraitUrl: undefined,
  };
}
