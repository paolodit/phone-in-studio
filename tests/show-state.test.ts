import { describe, expect, it } from "vitest";
import { transitionShow, type MachineState } from "@/lib/show-state";

describe("show state machine", () => {
  it("runs the mock caller sequence from idle to ended", () => {
    let state: MachineState = { showStatus: "DRAFT", broadcastState: "SHOW_IDLE", queueStatus: null };
    const start = transitionShow(state, "START_SHOW");
    expect(start).toMatchObject({ showStatus: "LIVE", broadcastState: "SHOW_IDLE", eventType: "SHOW_STARTED" });
    state = { ...state, ...start };
    const incoming = transitionShow(state, "CUE_NEXT", true);
    expect(incoming.broadcastState).toBe("CALLER_INCOMING");
    state = { ...state, ...incoming, queueStatus: "CONNECTING" };
    const connecting = transitionShow(state, "ANSWER_CALL");
    expect(connecting.broadcastState).toBe("CALLER_CONNECTING");
    state = { ...state, ...connecting };
    const live = transitionShow(state, "MOCK_CONNECT");
    expect(live.broadcastState).toBe("CALLER_LIVE");
    state = { ...state, ...live, queueStatus: "LIVE" };
    expect(transitionShow(state, "INTERRUPT_CALLER").eventType).toBe("CALLER_INTERRUPTED");
    expect(transitionShow(state, "END_CALL")).toMatchObject({ broadcastState: "CALLER_ENDED", eventType: "CALL_ENDED" });
  });

  it("refuses answer before an incoming caller and refuses cue without a queue item", () => {
    const state: MachineState = { showStatus: "LIVE", broadcastState: "SHOW_IDLE", queueStatus: null };
    expect(() => transitionShow(state, "ANSWER_CALL")).toThrow(/not valid/);
    expect(() => transitionShow(state, "CUE_NEXT", false)).toThrow(/not valid/);
  });
});
