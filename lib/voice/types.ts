export type CallerSessionConfig = {
  callerId: string;
  showId: string;
  instructions: string;
  voiceId: string;
  inputDeviceId?: string;
  onTranscript?: (entry: { speaker: "HOST" | "CALLER"; text: string }) => void;
  onLevels?: (levels: { input: number; output: number; inputBands: number[]; outputBands: number[] }) => void;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
};

export type LiveVoiceSession = {
  updateInstructions(instructions: string): Promise<void>;
  interrupt(): Promise<void>;
  muteOutput(muted: boolean): Promise<void>;
  setOutputVolume(volume: number): Promise<void>;
  switchInputDevice(deviceId: string): Promise<void>;
  endSession(): Promise<void>;
};

export interface LiveVoiceProvider {
  createSession(config: CallerSessionConfig): Promise<LiveVoiceSession>;
}
