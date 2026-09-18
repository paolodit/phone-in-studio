// Public menu labels only. Private template cast/story data stays server-side.
export const channelCreationModes = [
  { id: "custom", name: "Give Me the Keys", description: "Create your own channel with the existing show setup or planner." },
  { id: "human", name: "I’ll Take the Mic", description: "You present. Start with a pack of six independent AI guests." },
  { id: "auto", name: "Auto-run the Show", description: "One ready-made show, an AI presenter and five automatic guests. You stay in control." },
] as const;
export type ChannelCreationMode = typeof channelCreationModes[number]["id"];
export const defaultChannelCreationMode: ChannelCreationMode = "human";
export type StarterPackMenuItem = { id: string; mode: "human" | "auto"; name: string; description: string; expectedGuests: number; unavailableReason: string | null };
