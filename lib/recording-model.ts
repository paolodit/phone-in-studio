export type RecordingMarker = { id: string; seconds: number; label: string };
export type RecordingTranscript = { seconds: number; speaker: "HOST" | "CALLER"; text: string };
export type LocalRecording = {
  id: string; showId: string; showTitle: string; startedAt: string; durationSeconds: number;
  mimeType: string; status: "recording" | "ready" | "interrupted";
  markers: RecordingMarker[]; transcript: RecordingTranscript[]; includesMicrophone: boolean; note?: string;
};
export const recordingLockName = (id: string) => `phone-in:recording:${id}`;
export function recordingTime(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function recordingFilename(title: string, startedAt: string) {
  const safe = title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "phone-in";
  return `${safe}-${startedAt.slice(0, 19).replace(/[:T]/g, "-")}`;
}
/** Uses a monotonic clock, excluding pauses from recording/marker time. */
export class RecordingClock {
  private started: number;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  constructor(private now: () => number = () => performance.now()) { this.started = now(); }
  pause() { if (this.pausedAt === null) this.pausedAt = this.now(); }
  resume() { if (this.pausedAt !== null) { this.pausedTotal += this.now() - this.pausedAt; this.pausedAt = null; } }
  seconds() { return Math.max(0, ((this.pausedAt ?? this.now()) - this.started - this.pausedTotal) / 1000); }
}
