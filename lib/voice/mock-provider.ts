import type { CallerSessionConfig, LiveVoiceProvider, LiveVoiceSession } from "@/lib/voice/types";

/** A no-network provider used by Phase 1 state and browser-flow tests. */
export class MockVoiceProvider implements LiveVoiceProvider {
  async createSession(config: CallerSessionConfig): Promise<LiveVoiceSession> {
    let ended = false;
    let muted = false;
    let instructions = config.instructions;
    return {
      async updateInstructions(next) {
        if (!ended) instructions = next;
      },
      async interrupt() {
        if (ended) return;
      },
      async muteOutput(next) {
        if (!ended) muted = next;
      },
      async setOutputVolume() {
        if (ended) return;
      },
      async switchInputDevice() {
        if (ended) return;
      },
      async endSession() {
        ended = true;
        muted = true;
        instructions = "";
      },
    };
  }
}
