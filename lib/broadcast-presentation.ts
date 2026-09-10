export function broadcastPresentation(state: string) {
  return {
    showCaller: !["SHOW_IDLE", "SHOW_BREAK", "SHOW_ENDED"].includes(state),
    live: state === "CALLER_LIVE",
    stateLabel: ({ CALLER_LIVE: "ON AIR", CALLER_INCOMING: "COMING UP", CALLER_CONNECTING: "CONNECTING", CALLER_ON_HOLD: "ON HOLD", CALLER_ENDED: "CALL ENDED", SHOW_IDLE: "STANDING BY", SHOW_BREAK: "ON A BREAK", SHOW_ENDED: "SHOW COMPLETE" } as Record<string, string>)[state] ?? state.replaceAll("_", " "),
    kicker: ({ CALLER_INCOMING: "Coming up next", CALLER_CONNECTING: "Connecting caller", CALLER_ON_HOLD: "Caller on hold", CALLER_ENDED: "Thanks for calling" } as Record<string, string>)[state] ?? "On the line",
    idleHeadline: state === "SHOW_BREAK" ? "We’ll be right back." : state === "SHOW_ENDED" ? "Thanks for listening." : "The next call is coming in.",
  };
}

export const silentBands = Array.from({ length: 12 }, () => 0);
export function normalizeAudioLevels(value: unknown) {
  if (!value || typeof value !== "object") return { level: 0, bands: silentBands };
  const input = value as { level?: unknown; bands?: unknown };
  const clamp = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  return { level: clamp(input.level), bands: Array.isArray(input.bands) && input.bands.length === 12 ? input.bands.map(clamp) : silentBands };
}
