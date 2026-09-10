import { RecordingClock, recordingLockName, type LocalRecording, type RecordingTranscript } from "@/lib/recording-model";
import { deleteRecording, saveRecording, saveRecordingChunk } from "@/lib/recording-store";

export type RecorderState = "idle" | "starting" | "recording" | "paused" | "saving" | "ready" | "error";
export function supportedRecordingType() {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Records a user-selected Studio tab mix, plus an optional separate mic input.
 * Never feeds the mix to speakers, uploads media or records video frames. */
export class StudioRecorder {
  private streams: MediaStream[] = [];
  private context?: AudioContext;
  private recorder?: MediaRecorder;
  private clock?: RecordingClock;
  private timer?: ReturnType<typeof setInterval>;
  private writes: Promise<void> = Promise.resolve();
  private chunkIndex = 0;
  private cancelled = false;
  private stopping = false;
  private storageError = false;
  private recording?: LocalRecording;
  private releaseLock?: () => void;
  private currentState: RecorderState = "idle";
  constructor(private options: {
    showId: string; showTitle: string; includeMicrophone: boolean; inputDeviceId?: string;
    onState: (state: RecorderState, message?: string) => void;
    onTick: (seconds: number, tabLevel: number, microphoneLevel: number) => void;
    onSaved: (recording: LocalRecording) => void;
  }) {}
  private state(state: RecorderState, message?: string) { this.currentState = state; this.options.onState(state, message); }
  private checkCancelled() { if (this.cancelled) throw new DOMException("Recording setup cancelled", "AbortError"); }
  private release() {
    clearInterval(this.timer);
    for (const stream of this.streams) stream.getTracks().forEach((track) => track.stop());
    this.streams = [];
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => undefined);
  }
  private enqueue(task: () => Promise<void>) {
    this.writes = this.writes.then(task).catch(() => {
      this.storageError = true;
      this.stop("Browser storage filled or became unavailable. Only previously saved audio may be recoverable.");
    });
  }
  async start() {
    this.state("starting", "Choose this Studio tab and enable Share tab audio.");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") throw new Error("Recording needs Chrome or Edge on localhost/HTTPS with tab-audio sharing. Open the Studio there if this browser does not offer it.");
      const mimeType = supportedRecordingType();
      if (!mimeType) throw new Error("This browser cannot create a supported audio recording.");
      // Call immediately from the button's user gesture, before other awaits.
      const tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", systemAudio: "exclude" } as DisplayMediaStreamOptions);
      this.streams.push(tab); this.checkCancelled();
      if (tab.getVideoTracks()[0]?.getSettings().displaySurface !== "browser") throw new Error("Please select the Studio browser tab, not a whole screen or window.");
      if (!tab.getAudioTracks().length) throw new Error("No tab audio was shared. Try again, choose this Studio tab and enable Share tab audio. Nothing has been recorded.");
      let mic: MediaStream | undefined;
      if (this.options.includeMicrophone) {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, ...(this.options.inputDeviceId ? { deviceId: { exact: this.options.inputDeviceId } } : {}) } });
        this.streams.push(mic); this.checkCancelled();
      }
      this.context = new AudioContext(); await this.context.resume(); this.checkCancelled();
      const destination = this.context.createMediaStreamDestination();
      const limiter = this.context.createDynamicsCompressor(); limiter.connect(destination);
      const analyse = (stream: MediaStream) => { const node = this.context!.createAnalyser(); node.fftSize = 256; this.context!.createMediaStreamSource(stream).connect(node).connect(limiter); return node; };
      const tabMeter = analyse(new MediaStream(tab.getAudioTracks()));
      const micMeter = mic ? analyse(mic) : undefined;
      const level = (node?: AnalyserNode) => { if (!node) return 0; const data = new Uint8Array(node.fftSize); node.getByteTimeDomainData(data); return Math.min(1, data.reduce((sum, n) => sum + Math.abs(n - 128), 0) / data.length / 35); };
      this.recording = { id: crypto.randomUUID(), showId: this.options.showId, showTitle: this.options.showTitle, startedAt: new Date().toISOString(), durationSeconds: 0, mimeType, status: "recording", markers: [], transcript: [], includesMicrophone: this.options.includeMicrophone };
      // A browser-managed lock survives background throttling, but is released
      // automatically on tab close/crash. Recovery cannot race a live capture.
      if (navigator.locks) await new Promise<void>((resolve, reject) => {
        void navigator.locks.request(recordingLockName(this.recording!.id), async () => {
          await new Promise<void>((release) => { this.releaseLock = release; resolve(); });
        }).catch(reject);
      });
      await saveRecording(this.recording); this.checkCancelled();
      const recorder = new MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 192000 });
      this.recorder = recorder;
      recorder.ondataavailable = ({ data }) => {
        if (!data.size || !this.recording) return;
        const id = this.recording.id; const index = this.chunkIndex++;
        this.enqueue(() => saveRecordingChunk(id, index, data));
        this.persist();
      };
      recorder.onerror = () => this.stop("The browser interrupted the recorder. Check the saved audio before using it.");
      recorder.onstop = () => {
        this.release();
        this.enqueue(async () => {
          if (!this.recording) return;
          this.recording.status = this.recording.note || this.storageError ? "interrupted" : "ready";
          if (this.storageError) this.recording.note = "Storage failed during capture. This may be a partial recording.";
          await saveRecording(this.recording);
          this.options.onSaved(this.recording);
        });
        void this.writes.then(() => this.state(this.storageError ? "error" : "ready", this.storageError ? "Recording storage failed. Check Recordings for recoverable audio." : "Saved in this browser. Download a copy to keep it safe.")).finally(() => this.releaseLock?.());
      };
      for (const stream of this.streams) for (const track of stream.getTracks()) track.addEventListener("ended", () => this.stop("A capture source disconnected. The recording was stopped and saved."), { once: true });
      this.clock = new RecordingClock(); recorder.start(1000); this.state("recording", "Recording this tab and the selected audio sources.");
      this.timer = setInterval(() => {
        const seconds = this.clock!.seconds(); this.options.onTick(seconds, level(tabMeter), level(micMeter));
        if (seconds >= 7200) this.stop("Two-hour recording limit reached. Start another recording to continue.");
      }, 100);
    } catch (error) {
      if (this.recording) await deleteRecording(this.recording.id).catch(() => undefined);
      this.releaseLock?.();
      this.release(); this.state(this.cancelled ? "idle" : "error", this.cancelled ? "Recording setup cancelled." : error instanceof Error ? error.message : "Recording could not start.");
    }
  }
  private persist() {
    if (!this.recording) return;
    this.recording.durationSeconds = this.clock?.seconds() ?? 0;
    const snapshot = structuredClone(this.recording);
    this.enqueue(() => saveRecording(snapshot));
  }
  pause() {
    if (this.recorder?.state !== "recording") return;
    this.recorder.pause(); this.clock?.pause(); this.persist(); this.state("paused", "Paused: audio during this pause is not saved. Resume when ready.");
  }
  resume() {
    if (this.recorder?.state !== "paused") return;
    this.recorder.resume(); this.clock?.resume(); this.state("recording");
  }
  mark(label: string) {
    if (!this.recording || this.currentState !== "recording") return;
    this.recording.markers.push({ id: crypto.randomUUID(), seconds: this.clock!.seconds(), label: label.trim().slice(0, 160) || `Moment ${this.recording.markers.length + 1}` }); this.persist();
  }
  transcript(entry: Omit<RecordingTranscript, "seconds">) {
    if (!this.recording || this.currentState !== "recording") return;
    this.recording.transcript.push({ ...entry, seconds: this.clock!.seconds() });
    this.persist();
  }
  stop(note?: string) {
    if (this.stopping) return;
    this.cancelled = true; this.stopping = true;
    if (this.recording) { this.recording.durationSeconds = this.clock?.seconds() ?? 0; if (note) this.recording.note = note; }
    clearInterval(this.timer); this.clock?.pause();
    if (this.recorder && this.recorder.state !== "inactive") { this.state("saving", "Finishing and saving the recording…"); this.recorder.stop(); }
    else { this.release(); if (this.currentState !== "starting") this.state("idle"); }
  }
}
