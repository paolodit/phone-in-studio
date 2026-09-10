import { describe, expect, it } from "vitest";
import { RealtimeTurnTaking, shouldTakeFloor } from "@/lib/voice/turn-taking";

describe("guarded turn taking", () => {
  it.each(["uh huh", "um", "yeah, right", "hmm, okay", "I see", "go on", "[noise]", "", "no"])("leaves overlapping %s alone", (text) => {
    expect(shouldTakeFloor(text)).toBe(false);
  });
  it.each(["Wait", "Hang on a second", "But why did you do that?", "I disagree", "What? Why?"])("recognises a host taking the floor: %s", (text) => {
    expect(shouldTakeFloor(text)).toBe(true);
  });
  it("waits for a meaningful partial phrase, not a hesitation", () => {
    expect(shouldTakeFloor("um I", false)).toBe(false);
    expect(shouldTakeFloor("but what happened after that", false)).toBe(true);
  });
  function setup() {
    const events: Record<string, unknown>[] = [];
    return { events, turn: new RealtimeTurnTaking((event) => events.push(event)) };
  }
  it("answers at the semantic endpoint without waiting for transcription", () => {
    const { events, turn } = setup();
    turn.speechStarted("a"); turn.speechCommitted("a"); turn.transcript("a", "yes", true);
    expect(events.map((e) => e.type)).toEqual(["response.create"]);
  });
  it("does not pause, cancel or create another response for an acknowledgement", () => {
    const { events, turn } = setup();
    turn.responseStarted(); turn.playbackChanged(true);
    turn.speechStarted("a"); turn.speechCommitted("a"); turn.transcript("a", "uh huh", true);
    turn.responseFinished(); turn.playbackChanged(false);
    expect(events).toEqual([]);
  });
  it("clears audible output immediately, but waits for cancellation before replying", () => {
    const { events, turn } = setup();
    turn.responseStarted(); turn.playbackChanged(true); turn.speechStarted("a");
    turn.transcript("a", "Wait", false);
    turn.speechCommitted("a"); turn.transcript("a", "Wait, what do you mean?", true);
    expect(events.map((e) => e.type)).toEqual(["response.cancel", "output_audio_buffer.clear"]);
    turn.responseFinished();
    expect(events.at(-1)?.type).toBe("response.create");
    expect(events.filter((e) => e.type === "response.cancel")).toHaveLength(1);
  });
  it("interrupts audio even when generation has already finished", () => {
    const { events, turn } = setup();
    turn.playbackChanged(true); turn.speechStarted("a"); turn.speechCommitted("a");
    turn.transcript("a", "I have another question", true);
    expect(events.map((e) => e.type)).toEqual(["output_audio_buffer.clear", "response.create"]);
  });
  it("keeps manual-only mode as a fallback", () => {
    const { events, turn } = setup(); turn.setGuarded(false);
    turn.responseStarted(); turn.playbackChanged(true); turn.speechStarted("a");
    turn.speechCommitted("a"); turn.transcript("a", "Wait a minute", true);
    expect(events).toEqual([]);
    turn.interrupt(); expect(events).toHaveLength(2);
  });
  it("does not lose a question already in progress when the host presses interrupt", () => {
    const { events, turn } = setup(); turn.setGuarded(false);
    turn.responseStarted(); turn.playbackChanged(true); turn.speechStarted("a");
    turn.takeFloor(); turn.responseFinished(); turn.speechCommitted("a");
    expect(events.at(-1)?.type).toBe("response.create");
  });
});
