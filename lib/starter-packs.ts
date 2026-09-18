import type { CallerFormInput } from "@/lib/schemas";
import type { ShowFormatId, VoiceProviderId } from "@/lib/show-format";
import type { StarterPackMenuItem } from "@/lib/channel-creation-options";

export type PackImage = { url: string; label: string; creditText?: string; creditUrl?: string };
export type StarterGuest = {
  id: string;
  caller: CallerFormInput;
  portrait: PackImage;
  imagery: { query: string; images?: readonly PackImage[] };
};
export type StarterPresenter = {
  name: string; publicIdentity: string; voiceId: string; stylePreset: string;
  guidance: string; boundaries: string;
  characteristics: { warmth: number; energy: number; patience: number; playfulness: number };
};
export type StarterPack = {
  id: string; version: number; mode: "human" | "auto";
  name: string; description: string; instructions: string; formatId: ShowFormatId;
  expectedGuests: 5 | 6;
  editorialStatus: "awaiting-cast" | "awaiting-theme-and-cast" | "ready";
  cast: readonly StarterGuest[];
  presenter?: StarterPresenter;
  imagery: { query: string; imagesPerGuest: number };
  defaults: {
    voiceProvider: VoiceProviderId;
    music: { enabled: boolean; trackId: string; volume: number; loop: boolean };
    imageAutoplay: { enabled: boolean; intervalSeconds: number };
    maxTurnsPerCaller: number; betweenCallsSeconds: number;
  };
};

const defaults = (trackId: string): StarterPack["defaults"] => ({
  voiceProvider: "openai",
  music: { enabled: true, trackId, volume: 0.12, loop: true },
  imageAutoplay: { enabled: true, intervalSeconds: 10 },
  maxTurnsPerCaller: 4, betweenCallsSeconds: 3,
});
export const independentGuestInstructions = "Every guest is independent. Do not invent relationships, shared history, shared story state or awareness of other callers in this channel. Speak only from this caller’s own story and the current conversation with the host.";

// Editorial source of truth. Final characters have deliberately NOT been invented.
// Populate cast (and the auto presenter/theme), then set editorialStatus to ready.
// The creation service validates the complete pack again before writing anything.
export const starterPacks: readonly StarterPack[] = [
  {
    id: "am-i-the-asshole", version: 1, mode: "human", name: "Am I the A**hole?",
    description: "Personal disputes, uncomfortable details and your verdict. Question each caller before deciding who was in the wrong.",
    instructions: "Callers explain a specific personal dispute from their own perspective. Let the human host ask questions, uncover relevant details and deliver a verdict. Do not deliver the host’s verdict for them. React naturally to a fair challenge; do not force every story towards the same answer.",
    formatId: "advice", expectedGuests: 6, editorialStatus: "awaiting-cast", cast: [],
    imagery: { query: "everyday life home objects", imagesPerGuest: 3 }, defaults: defaults("cool-vibes"),
  },
  {
    id: "who-booked-these-guests", version: 1, mode: "human", name: "Who Booked These Guests?",
    description: "Outrageous personal stories and unexpected revelations, with the energy of a Jerry Springer-style phone-in.",
    instructions: "Bring a heightened, fictional personal story with specific stakes and surprising revelations. Give the host room to question, challenge and react. Reveal details through conversation, not an opening monologue. No shared cast relationships or staged confrontations between guests. Keep the drama in the story, not abuse of real people.",
    formatId: "entertainment", expectedGuests: 6, editorialStatus: "awaiting-cast", cast: [],
    imagery: { query: "telephone colorful living room", imagesPerGuest: 3 }, defaults: defaults("local-forecast"),
  },
  {
    id: "bad-joke-hotline", version: 1, mode: "human", name: "Bad Joke Hotline",
    description: "Six comedy personalities, questionable delivery and jokes that may need explaining. You decide when to move on.",
    instructions: "Bring the caller’s own prepared jokes and distinctive comedy style. Tell one joke at a time and let the host respond. Questionable delivery is part of the caller’s personality, not a reason to ignore interruptions. Stay in a responsive phone conversation; do not turn the call into a stand-up monologue.",
    formatId: "entertainment", expectedGuests: 6, editorialStatus: "awaiting-cast", cast: [],
    imagery: { query: "comedy microphone stage", imagesPerGuest: 3 }, defaults: defaults("lobby-time"),
  },
  {
    id: "auto-run", version: 1, mode: "auto", name: "Auto-run starter show",
    description: "One AI presenter and five independent guests. The theme, presenter and final cast are still to be confirmed.",
    instructions: "", formatId: "general", expectedGuests: 5,
    editorialStatus: "awaiting-theme-and-cast", cast: [],
    imagery: { query: "radio studio microphone", imagesPerGuest: 3 }, defaults: defaults("late-night-radio"),
  },
];

export function starterPackIssue(pack: StarterPack): string | null {
  if (pack.editorialStatus === "awaiting-theme-and-cast") return "Theme, presenter and five guests to be confirmed.";
  if (pack.editorialStatus !== "ready") return `${pack.expectedGuests} curated guests to be confirmed.`;
  if (pack.expectedGuests !== (pack.mode === "auto" ? 5 : 6) || pack.cast.length !== pack.expectedGuests) return "The complete curated cast is not ready yet.";
  if (new Set(pack.cast.map((guest) => guest.id)).size !== pack.cast.length) return "Guest IDs must be unique within a pack.";
  if (!pack.instructions.trim() || (pack.mode === "auto" && !pack.presenter)) return "The show instructions and presenter are not ready yet.";
  return null;
}

// Only public menu content crosses the server/client boundary, never private stories.
export const starterPackMenu: StarterPackMenuItem[] = starterPacks.map((pack) => ({
  id: pack.id, mode: pack.mode, name: pack.name, description: pack.description,
  expectedGuests: pack.expectedGuests, unavailableReason: starterPackIssue(pack),
}));
