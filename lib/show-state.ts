import type { BroadcastState, QueueItemStatus, ShowEventType, ShowStatus } from "@/generated/prisma/client";
import type { StudioControlAction } from "@/lib/schemas";

export type MachineState = {
  showStatus: ShowStatus;
  broadcastState: BroadcastState;
  queueStatus: QueueItemStatus | null;
};

export type Transition = {
  showStatus: ShowStatus;
  broadcastState: BroadcastState;
  eventType: ShowEventType;
};

const invalid = (action: StudioControlAction, state: MachineState): never => {
  throw new Error(`${action} is not valid while the display is ${state.broadcastState}.`);
};

export function transitionShow(state: MachineState, action: StudioControlAction, hasNext = false): Transition {
  switch (action) {
    case "START_SHOW":
      if (state.showStatus !== "DRAFT" && state.showStatus !== "READY") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "SHOW_IDLE", eventType: "SHOW_STARTED" };
    case "CUE_NEXT":
      if (state.showStatus !== "LIVE" || !["SHOW_IDLE", "CALLER_ENDED", "SHOW_BREAK"].includes(state.broadcastState) || !hasNext) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_INCOMING", eventType: "CALLER_INCOMING" };
    case "ANSWER_CALL":
      if (state.broadcastState !== "CALLER_INCOMING") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_CONNECTING", eventType: "CALLER_CONNECTING" };
    case "MOCK_CONNECT":
      if (state.broadcastState !== "CALLER_CONNECTING") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_LIVE", eventType: "CALLER_CONNECTED" };
    case "MOCK_SPEAK":
      if (state.broadcastState !== "CALLER_LIVE") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_LIVE", eventType: "CALLER_SPEAKING_STARTED" };
    case "INTERRUPT_CALLER":
      if (state.broadcastState !== "CALLER_LIVE") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_LIVE", eventType: "CALLER_INTERRUPTED" };
    case "MUTE_CALLER":
      if (!["CALLER_LIVE", "CALLER_ON_HOLD"].includes(state.broadcastState)) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: state.broadcastState, eventType: "CALLER_MUTED" };
    case "UNMUTE_CALLER":
      if (!["CALLER_LIVE", "CALLER_ON_HOLD"].includes(state.broadcastState)) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: state.broadcastState, eventType: "CALLER_UNMUTED" };
    case "HOLD_CALLER":
      if (state.broadcastState !== "CALLER_LIVE") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_ON_HOLD", eventType: "CALLER_HELD" };
    case "RESUME_CALLER":
      if (state.broadcastState !== "CALLER_ON_HOLD") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_LIVE", eventType: "CALLER_RESUMED" };
    case "END_CALL":
      if (!["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(state.broadcastState)) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_ENDED", eventType: "CALL_ENDED" };
    case "CALLER_HANGS_UP":
      if (!["CALLER_INCOMING", "CALLER_CONNECTING", "CALLER_LIVE", "CALLER_ON_HOLD"].includes(state.broadcastState)) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "CALLER_ENDED", eventType: "CALL_ENDED" };
    case "SKIP_CALLER":
      if (!["CALLER_INCOMING", "CALLER_CONNECTING"].includes(state.broadcastState)) return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "SHOW_IDLE", eventType: "CALL_ENDED" };
    case "EMERGENCY_STOP":
      if (state.showStatus !== "LIVE") return invalid(action, state);
      return { showStatus: "LIVE", broadcastState: "SHOW_BREAK", eventType: "EMERGENCY_STOP" };
    case "END_SHOW":
      if (state.showStatus !== "LIVE") return invalid(action, state);
      return { showStatus: "ENDED", broadcastState: "SHOW_ENDED", eventType: "SHOW_ENDED" };
  }
}
