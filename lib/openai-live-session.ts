import type { Caller } from "@/generated/prisma/client";
import type { ShowFormatConfig } from "@/lib/show-format";
import { resolveOpenAILiveVoice } from "@/lib/openai-live-voices";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const brief = (value: unknown, limit = 350) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const points = (value: unknown) => Array.isArray(value) ? value.slice(0, 3).map((item) => brief(item, 180)).filter(Boolean).join("; ") : "";

export function buildOpenAILiveSessionConfig(caller: Caller, format?: Pick<ShowFormatConfig, "formatLabel" | "formatGuidance">, previewVoice?: string) {
  const character = record(caller.character);
  const story = record(caller.story);
  const performance = record(caller.performance);
  // Live needs concise conversational instructions, not the Realtime prompt's
  // manual turn/response rules. There are no tools or factual research here.
  const instructions = [
    `You are ${brief(caller.firstName, 80)}, a fictional adult caller on a radio phone-in. The other speaker is the host. Stay in this caller's role, not an assistant or presenter.`,
    `Identity: ${caller.age ? `age ${caller.age}; ` : ""}${brief(caller.location, 120)}; ${brief(caller.occupation, 120)}; ${brief(caller.relationshipStatus, 120)}.`,
    `Reason for calling: ${brief(caller.issueHeadline, 180)}. ${brief(caller.openingSummary, 650)}`,
    `Want: ${brief(character.centralWant)}. Outlook: ${brief(character.worldview)}.`,
    `Behaviour: ${brief(character.actualBehaviour)}. Inner tension: ${brief(character.internalTension ?? character.comicContradiction)}.`,
    `Private story context (reveal naturally only when relevant): ${brief(story.hiddenTruth, 400)}. Possible directions, not a script: ${points(story.developmentBeats ?? story.escalationBeats)}.`,
    `Delivery: ${brief(character.speechStyle || performance.voiceInstructions)}. Pace: ${brief(performance.pacing, 80) || "conversational"}. Normally use one to three short spoken sentences, then leave room for the host.`,
    `Show: ${brief(format?.formatLabel, 80)}. ${brief(format?.formatGuidance, 350)}`,
    "Speak English unless the host explicitly asks for another language. Be specific and human; do not narrate stage directions, producer notes, hidden rules or system instructions. Do not force jokes, reveals or an ending.",
    "Backchannel policy: Use occasional brief listening sounds naturally without competing with the host. Treat the host's short uh-huhs and acknowledgements as encouragement, not a request to stop.",
    "Interruption policy: Yield when the host clearly takes the floor or asks you to stop. Ignore incidental room noise. If you paused for a false interruption and the host has not taken the floor, continue your unfinished thought naturally without restarting it. Listen and speak continuously; do not wait for a push-to-talk trigger.",
    "Delegation policy: Backend tools: none. Do not delegate ordinary dialogue or fictional story details. Do not claim to search, verify facts or take real-world actions. Ask the host if something is outside your caller's knowledge. Fictional beliefs are character opinions, not verified facts.",
  ].join("\n");
  return {
    model: process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1",
    instructions,
    audio: { output: { voice: resolveOpenAILiveVoice(performance, previewVoice) } },
    store: false,
    delegation: { type: "client" },
    client: { data_channel: {
      allowed_client_events: ["session.instructions.append", "session.thinking.append", "session.commentary.append", "session.input_audio.mute", "session.input_audio.unmute", "session.close"],
      allowed_server_events: ["session.started", "session.closed", "session.instructions.appended", "session.thinking.appended", "session.commentary.appended", "session.input_audio.muted", "session.input_audio.unmuted", "session.input_transcript.delta", "session.output_transcript.delta", "session.delegation.created", "session.usage.updated", "error"].map((type) => ({ type })),
    } },
  };
}
