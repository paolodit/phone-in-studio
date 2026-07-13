import { z } from "zod";
import {
  callerIdeaSeedSchema,
  callerPremiseSchema,
  callerPremisesSchema,
  type CallerFormInput,
  type CallerPremise,
  generatedCallerDraftSchema,
  type GeneratedCallerDraft,
} from "@/lib/schemas";

export const CALLER_WORKSHOP_PROMPT_VERSION = "2026-07-12.1";
const DEFAULT_CALLER_GENERATION_MODEL = "gpt-5.4-mini";

type JsonSchema = Record<string, unknown>;

const premiseItemJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    setup: { type: "string" },
    callerPointOfView: { type: "string" },
    comicContradiction: { type: "string" },
    escalationPossibility: { type: "string" },
    hostChallenge: { type: "string" },
    originalityWarning: { type: "string" },
  },
  required: ["title", "setup", "callerPointOfView", "comicContradiction", "escalationPossibility", "hostChallenge", "originalityWarning"],
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
    centralWant: { type: "string" }, worldview: { type: "string" }, actualBehaviour: { type: "string" }, comicContradiction: { type: "string" },
    speechStyle: { type: "string" }, hiddenTruth: { type: "string" },
    escalationBeats: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    suggestedQuestions: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    voiceId: { type: "string", enum: ["alloy", "ash", "ballad", "coral", "cedar", "echo", "marin", "sage", "shimmer", "verse"] },
    originalityNotes: { type: "string" }, producerReviewNotes: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
  },
  required: [
    "firstName", "surnameInitial", "age", "location", "occupation", "relationshipStatus", "issueHeadline", "openingSummary",
    "centralWant", "worldview", "actualBehaviour", "comicContradiction", "speechStyle", "hiddenTruth", "escalationBeats", "suggestedQuestions",
    "voiceId", "originalityNotes", "producerReviewNotes",
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

export async function generateCallerPremises(sourceNotes: string) {
  const input = callerIdeaSeedSchema.parse({ sourceNotes });
  return requestStructuredOutput({
    name: "caller_premises",
    schema: premisesJsonSchema,
    maxOutputTokens: 2_000,
    instructions: [
      "You are a development editor for a fictional, adult UK radio phone-in comedy show.",
      "Generate exactly six clearly different premise options from the producer's seed. Every caller must be wholly fictional and an adult.",
      "Do not use real people, real private individuals, brands, existing fictional characters, performers' styles, protected characteristics as the joke, slurs, cruelty, medical or legal allegations, criminal accusations, or traumatic subjects.",
      "Make the comic engine come from a mundane dispute, the caller's blind spot, and a host who can courteously challenge the contradiction.",
      "The originality warning should tell the producer what to vary or check before using the idea. Keep all fields concise and production-useful.",
    ].join(" "),
    input: `Producer seed notes:\n${input.sourceNotes}`,
    validate: (value) => callerPremisesSchema.parse(value).premises,
  });
}

export async function developCallerFromPremise(sourceNotes: string, premise: CallerPremise) {
  const input = callerIdeaSeedSchema.parse({ sourceNotes });
  const selectedPremise = callerPremiseSchema.parse(premise);
  return requestStructuredOutput({
    name: "caller_draft",
    schema: callerDraftJsonSchema,
    maxOutputTokens: 3_000,
    instructions: [
      "You are a development editor for a fictional, adult UK radio phone-in comedy show.",
      "Turn the producer's seed and selected premise into one internally consistent caller card. It is a private production draft, never an approved or live caller.",
      "The caller must be wholly fictional and adult. Do not use real people, brands, existing fictional characters, performer styles, protected characteristics as punchlines, slurs, cruelty, medical or legal allegations, criminal accusations, or traumatic subjects.",
      "Use a mundane, reversible problem. Make the public summary playable, the hidden truth specific, and the host questions fair rather than cruel.",
      "Choose one suitable voiceId from the allowed options. Spread voices across callers over time rather than always choosing the same one. The producer review notes must identify checks a human should make before approval, including originality and tone.",
    ].join(" "),
    input: `Producer seed notes:\n${input.sourceNotes}\n\nSelected premise:\n${JSON.stringify(selectedPremise)}`,
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
    centralWant: draft.centralWant,
    worldview: draft.worldview,
    actualBehaviour: draft.actualBehaviour,
    comicContradiction: draft.comicContradiction,
    speechStyle: draft.speechStyle,
    hiddenTruth: draft.hiddenTruth,
    escalationBeats: draft.escalationBeats.join("\n"),
    suggestedQuestions: draft.suggestedQuestions.join("\n"),
    voiceId: draft.voiceId,
    portraitUrl: undefined,
  };
}
