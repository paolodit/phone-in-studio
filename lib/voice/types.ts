export type CallerSessionConfig = {
  callerId: string;
  showId: string;
  testMode?: boolean;
  signal?: AbortSignal;
  instructions: string;
  voiceId: string;
  /** Private GPT-Live audition only; never overrides production casting. */
  previewVoice?: string;
  inputDeviceId?: string;
  interruptionMode?: "guarded" | "manual";
  onPlaybackChange?: (speaking: boolean) => void;
  onReplyLatency?: (milliseconds: number) => void;
  onDisconnected?: () => void;
  onTranscript?: (entry: { speaker: "HOST" | "CALLER"; text: string }) => void;
  onLevels?: (levels: { input: number; output: number; inputBands: number[]; outputBands: number[] }) => void;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
};

export type LiveVoiceSession = {
  updateInstructions(instructions: string): Promise<void>;
  sendHostText(text: string): Promise<void>;
  interrupt(): Promise<void>;
  muteInput(muted: boolean): Promise<void>;
  muteOutput(muted: boolean): Promise<void>;
  setOutputVolume(volume: number): Promise<void>;
  switchInputDevice(deviceId: string): Promise<void>;
  setInterruptionMode?(mode: "guarded" | "manual"): void;
  endSession(): Promise<void>;
};

export interface LiveVoiceProvider {
  createSession(config: CallerSessionConfig): Promise<LiveVoiceSession>;
}
