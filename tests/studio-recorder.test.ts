import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioRecorder } from "@/lib/studio-recorder";
import { deleteRecording, saveRecording, saveRecordingChunk } from "@/lib/recording-store";
vi.mock("@/lib/recording-store", () => ({ deleteRecording: vi.fn(async () => undefined), saveRecording: vi.fn(async () => undefined), saveRecordingChunk: vi.fn(async () => undefined) }));
class Track {
  stop = vi.fn(); ended?: () => void;
  constructor(public kind: string) {}
  addEventListener(_name: string, callback: () => void) { this.ended = callback; }
  getSettings() { return { displaySurface: "browser" }; }
}
class Stream {
  constructor(private tracks: Track[]) {}
  getTracks() { return this.tracks; } getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); } getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
}
class NodeStub { fftSize = 256; connect() { return this; } getByteTimeDomainData(data: Uint8Array) { data.fill(128); } }
class Context {
  state = "running"; async resume() {} async close() { this.state = "closed"; }
  createMediaStreamDestination() { return { stream: new Stream([new Track("audio")]) }; }
  createDynamicsCompressor() { return new NodeStub(); } createAnalyser() { return new NodeStub(); } createMediaStreamSource() { return new NodeStub(); }
}
class Recorder {
  static current: Recorder; static isTypeSupported() { return true; }
  state = "inactive"; ondataavailable?: (event: { data: Blob }) => void; onstop?: () => void;
  constructor() { Recorder.current = this; }
  start() { this.state = "recording"; } pause() { this.state = "paused"; } resume() { this.state = "recording"; }
  emit() { this.ondataavailable?.({ data: new Blob(["audio"]) }); }
  stop() { this.state = "inactive"; queueMicrotask(() => { this.emit(); this.onstop?.(); }); }
}
describe("Local Studio recorder", () => {
  let tab: Stream; let mic: Stream; const instances: StudioRecorder[] = [];
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(saveRecording).mockResolvedValue(undefined); vi.mocked(saveRecordingChunk).mockResolvedValue(undefined);
    tab = new Stream([new Track("video"), new Track("audio")]); mic = new Stream([new Track("audio")]);
    vi.stubGlobal("window", { isSecureContext: true }); vi.stubGlobal("MediaRecorder", Recorder); vi.stubGlobal("MediaStream", Stream); vi.stubGlobal("AudioContext", Context);
    vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: vi.fn(async () => tab), getUserMedia: vi.fn(async () => mic) } });
  });
  afterEach(async () => { instances.forEach((item) => item.stop()); instances.length = 0; await new Promise((resolve) => setTimeout(resolve, 0)); vi.unstubAllGlobals(); });
  function create() { const onState = vi.fn(), onSaved = vi.fn(); const recorder = new StudioRecorder({ showId: "test", showTitle: "Test show", includeMicrophone: true, onState, onSaved, onTick: vi.fn() }); instances.push(recorder); return { recorder, onState, onSaved }; }
  it("refuses capture without tab audio and releases tracks", async () => {
    tab = new Stream([new Track("video")]); const { recorder, onState } = create(); await recorder.start();
    expect(onState).toHaveBeenLastCalledWith("error", expect.stringContaining("No tab audio")); expect(tab.getTracks()[0].stop).toHaveBeenCalled(); expect(saveRecording).not.toHaveBeenCalled();
  });
  it("cleans up if microphone permission fails", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error("Mic blocked")); const { recorder, onState } = create(); await recorder.start();
    expect(tab.getTracks()[0].stop).toHaveBeenCalled(); expect(onState).toHaveBeenLastCalledWith("error", "Mic blocked");
  });
  it("does not start after a cancelled permission request resolves", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockReturnValue(new Promise((done) => { resolve = done as typeof resolve; }));
    const { recorder, onState } = create(); const pending = recorder.start(); recorder.stop(); resolve(tab); await pending;
    expect(onState).toHaveBeenLastCalledWith("idle", "Recording setup cancelled."); expect(saveRecording).not.toHaveBeenCalled(); expect(tab.getTracks()[0].stop).toHaveBeenCalled();
  });
  it("saves chunks, markers and only unpaused transcripts", async () => {
    const { recorder, onSaved } = create(); await recorder.start();
    recorder.mark("A good question"); recorder.transcript({ speaker: "HOST", text: "Why now?" });
    recorder.pause(); recorder.mark("Private"); recorder.transcript({ speaker: "HOST", text: "Not for recording" }); recorder.resume();
    recorder.stop(); await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const saved = onSaved.mock.calls[0][0]; expect(saved.status).toBe("ready"); expect(saved.markers).toHaveLength(1); expect(saved.transcript).toHaveLength(1);
    expect(saveRecordingChunk).toHaveBeenCalledOnce(); expect(tab.getTracks()[0].stop).toHaveBeenCalled(); expect(mic.getTracks()[0].stop).toHaveBeenCalled();
  });
  it("cleans up metadata when setup is cancelled while storage is opening", async () => {
    let resolve!: () => void;
    vi.mocked(saveRecording).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { recorder, onState } = create(); const pending = recorder.start();
    await vi.waitFor(() => expect(saveRecording).toHaveBeenCalledOnce()); recorder.stop(); resolve(); await pending;
    expect(deleteRecording).toHaveBeenCalledOnce(); expect(onState).toHaveBeenLastCalledWith("idle", "Recording setup cancelled.");
  });
  it("saves partial audio when a source disconnects", async () => {
    const { recorder, onSaved } = create(); await recorder.start(); tab.getTracks()[0].ended?.();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce()); expect(onSaved.mock.calls[0][0].status).toBe("interrupted");
  });
  it("owns a browser lock until the final recording is saved", async () => {
    const released = vi.fn();
    const request = vi.fn(async (_name: string, callback: () => Promise<void>) => { await callback(); released(); });
    Object.assign(navigator, { locks: { request } });
    const { recorder, onSaved } = create(); await recorder.start();
    expect(request).toHaveBeenCalledWith(expect.stringContaining("phone-in:recording:"), expect.any(Function)); expect(released).not.toHaveBeenCalled();
    recorder.stop(); await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce()); await vi.waitFor(() => expect(released).toHaveBeenCalledOnce());
  });
  it("stops instead of silently losing audio on storage failure", async () => {
    const { recorder, onState } = create(); await recorder.start(); vi.mocked(saveRecordingChunk).mockRejectedValue(new Error("Quota")); Recorder.current.emit();
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith("error", expect.stringContaining("storage failed")));
    expect(tab.getTracks()[0].stop).toHaveBeenCalled();
  });
});
