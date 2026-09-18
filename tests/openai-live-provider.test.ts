import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAILiveVoiceProvider } from "@/lib/voice/openai-live-provider";
import { LiveTranscriptBuffer } from "@/lib/voice/openai-live-protocol";

class NodeStub {
  fftSize = 256; frequencyBinCount = 128; gain = { value: 1 };
  connect() { return this; } disconnect() {}
  getByteTimeDomainData(values: Uint8Array) { values.fill(128); }
  getByteFrequencyData(values: Uint8Array) { values.fill(0); }
}
class ContextStub {
  static last: ContextStub; destination = new NodeStub(); state = "running";
  close = vi.fn(async () => { this.state = "closed"; });
  constructor() { ContextStub.last = this; }
  async resume() {} createAnalyser() { return new NodeStub(); } createGain() { return new NodeStub(); } createMediaStreamSource() { return new NodeStub(); }
}
class AudioStub {
  static last: AudioStub; paused = true; volume = 1; muted = false; srcObject: unknown;
  constructor() { AudioStub.last = this; }
  setAttribute() {} pause() { this.paused = true; } async play() { this.paused = false; }
}
class PeerStub extends EventTarget {
  static last: PeerStub; static autoStart = true; static autoClose = true;
  connectionState = "new"; iceGatheringState = "complete"; localDescription = { sdp: "gathered-offer" };
  onconnectionstatechange?: () => void;
  events = { readyState: "connecting", onmessage: undefined as ((event: { data: string }) => void) | undefined, onclose: undefined as (() => void) | undefined, close: vi.fn(), send: vi.fn((data: string) => {
    const event = JSON.parse(data);
    queueMicrotask(() => {
      if (event.type.endsWith(".append")) this.emit({ type: event.type + "ed", client_event_id: event.event_id });
      if (event.type === "session.close" && PeerStub.autoClose) this.emit({ type: "session.closed", reason: "close_requested" });
    });
  }) };
  sender = { replaceTrack: vi.fn(async () => undefined) };
  close = vi.fn();
  constructor() { super(); PeerStub.last = this; }
  createDataChannel() { return this.events; } addTrack() { return this.sender; }
  async createOffer() { return { sdp: "ungathered-offer" }; } async setLocalDescription() {}
  async setRemoteDescription() { this.events.readyState = "open"; if (PeerStub.autoStart) this.emit({ type: "session.started", session: { id: "live_test" } }); }
  emit(event: Record<string, unknown>) { this.events.onmessage?.({ data: JSON.stringify(event) }); }
  sent() { return this.events.send.mock.calls.map(([data]) => JSON.parse(data)); }
}

describe("GPT-Live WebRTC lifecycle", () => {
  const tracks: { enabled: boolean; stop: ReturnType<typeof vi.fn> }[] = [];
  const config = { callerId: "test", showId: "show", instructions: "", voiceId: "coral", testMode: true };
  beforeEach(() => {
    tracks.length = 0; PeerStub.autoStart = true; PeerStub.autoClose = true;
    vi.stubGlobal("window", Object.assign(new EventTarget(), { isSecureContext: true, location: { origin: "http://localhost:3000" } }));
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(), mediaDevices: { getUserMedia: vi.fn(async () => { const track = { enabled: true, stop: vi.fn() }; tracks.push(track); return { getTracks: () => [track], getAudioTracks: () => [track] }; }) } });
    vi.stubGlobal("RTCPeerConnection", PeerStub); vi.stubGlobal("AudioContext", ContextStub); vi.stubGlobal("Audio", AudioStub);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1)); vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sdp: "answer", sessionId: "live_test", closeToken: "signed-test-token", model: "gpt-live-1", voice: "coral" }) })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("uses gathered SDP, waits for session.started and opens with acknowledged Live instructions", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession({ ...config, previewVoice: "willow" });
    await Promise.resolve();
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request[0]).toBe("/api/openai-live/call");
    expect(JSON.parse(request[1]?.body as string)).toMatchObject({ sdp: "gathered-offer", previewVoice: "willow", testMode: true });
    const types = PeerStub.last.sent().map((event) => event.type);
    expect(types).toEqual(["session.instructions.append", "session.commentary.append"]);
    expect(types).not.toContain("response.create");
    await session.endSession();
    expect(PeerStub.last.sent().at(-1).type).toBe("session.close");
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not treat opening the data channel as a started session", async () => {
    PeerStub.autoStart = false;
    const previousPeer = PeerStub.last;
    let resolved = false;
    const connecting = new OpenAILiveVoiceProvider().createSession(config).then((session) => { resolved = true; return session; });
    await vi.waitFor(() => { expect(PeerStub.last).not.toBe(previousPeer); expect(PeerStub.last.events.readyState).toBe("open"); });
    expect(resolved).toBe(false); expect(PeerStub.last.sent()).toEqual([]);
    PeerStub.last.emit({ type: "session.started" });
    await (await connecting).endSession();
  });
  it("does not interrupt on transcript fragments or acknowledgements", async () => {
    const transcript = vi.fn();
    const session = await new OpenAILiveVoiceProvider().createSession({ ...config, onTranscript: transcript });
    await Promise.resolve();
    const count = PeerStub.last.sent().length;
    PeerStub.last.emit({ type: "session.input_transcript.delta", delta: "uh-huh", event_id: "one" });
    PeerStub.last.emit({ type: "session.input_transcript.delta", delta: "uh-huh", event_id: "one" });
    PeerStub.last.emit({ type: "session.output_transcript.delta", delta: "As I was saying…" });
    expect(PeerStub.last.sent()).toHaveLength(count);
    expect(tracks[0].enabled).toBe(true);
    await session.endSession();
    expect(transcript.mock.calls.map(([entry]) => entry)).toEqual([{ speaker: "HOST", text: "uh-huh" }, { speaker: "CALLER", text: "As I was saying…" }]);
  });
  it("mutes immediately for deliberate interrupt without unsupported cancellation events", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession(config);
    await session.interrupt();
    expect(AudioStub.last.muted).toBe(true);
    const sent = PeerStub.last.sent();
    expect(sent.at(-1).content).toContain("taking the floor");
    expect(sent.map((event) => event.type)).not.toContain("response.cancel");
    await session.endSession();
  });
  it("uses Live instructions for direction and quoted context for the AI host", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession(config);
    await session.updateInstructions("Speak more slowly.");
    await session.sendHostText("What do you want to happen next?");
    expect(PeerStub.last.sent().some((event) => event.type === "session.thinking.append" && event.content.includes("quoted conversation"))).toBe(true);
    expect(PeerStub.last.sent().some((event) => event.type === "session.update")).toBe(false);
    await session.endSession();
  });
  it("preserves mute and volume across input-device changes", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession(config);
    await session.muteInput(true); await session.switchInputDevice("second");
    expect(tracks[1].enabled).toBe(false); expect(tracks[0].stop).toHaveBeenCalledOnce();
    await session.setOutputVolume(.25); expect(AudioStub.last.volume).toBe(.25);
    await session.endSession(); await session.endSession(); expect(tracks[1].stop).toHaveBeenCalledOnce();
  });
  it("releases hardware on failed HTTP negotiation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Offline"); }));
    await expect(new OpenAILiveVoiceProvider().createSession(config)).rejects.toThrow("Offline");
    expect(tracks[0].stop).toHaveBeenCalledOnce(); expect(ContextStub.last.close).toHaveBeenCalledOnce();
  });
  it("hangs up a created session after peer failure", async () => {
    const disconnected = vi.fn();
    const session = await new OpenAILiveVoiceProvider().createSession({ ...config, onDisconnected: disconnected });
    PeerStub.last.connectionState = "failed"; PeerStub.last.onconnectionstatechange?.();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("/api/openai-live/close");
    expect(disconnected).toHaveBeenCalledOnce(); await session.endSession();
  });
  it("uses authenticated fallback hangup when session.closed never arrives", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession(config);
    PeerStub.autoClose = false; vi.useFakeTimers();
    const ending = session.endSession();
    expect(AudioStub.last.muted).toBe(true);
    await vi.advanceTimersByTimeAsync(3001); await ending;
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("/api/openai-live/close");
    expect(tracks[0].stop).toHaveBeenCalledOnce();
  });
  it("allows brief network recovery but closes a sustained disconnect", async () => {
    const session = await new OpenAILiveVoiceProvider().createSession(config);
    vi.useFakeTimers();
    PeerStub.last.connectionState = "disconnected"; PeerStub.last.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(4000);
    PeerStub.last.connectionState = "connected"; PeerStub.last.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    PeerStub.last.connectionState = "disconnected"; PeerStub.last.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(8001);
    expect(fetch).toHaveBeenCalledTimes(2); expect(tracks[0].stop).toHaveBeenCalledOnce();
    await session.endSession();
  });
  it("closes a late HTTP session answer after page navigation", async () => {
    let returnAnswer!: (value: unknown) => void;
    const lateAnswer = new Promise((resolve) => { returnAnswer = resolve; });
    const previousPeer = PeerStub.last;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => lateAnswer).mockResolvedValue({ ok: true }));
    const connecting = new OpenAILiveVoiceProvider().createSession(config);
    const rejected = expect(connecting).rejects.toThrow("cancelled");
    await vi.waitFor(() => { expect(PeerStub.last).not.toBe(previousPeer); expect(fetch).toHaveBeenCalledOnce(); });
    window.dispatchEvent(new Event("pagehide"));
    returnAnswer({ ok: true, json: async () => ({ sdp: "answer", sessionId: "late-session", closeToken: "late-token", voice: "marin" }) });
    await rejected;
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("/api/openai-live/close");
    expect(tracks[0].stop).toHaveBeenCalledOnce();
  });
});

describe("continuous Live transcript batching", () => {
  it("preserves exact fragments separately for overlapping speakers", () => {
    const emit = vi.fn(); const buffer = new LiveTranscriptBuffer(emit);
    buffer.push({ speaker: "CALLER", delta: "Well, " }); buffer.push({ speaker: "HOST", delta: "mm-hmm" }); buffer.push({ speaker: "CALLER", delta: "I I think so." });
    buffer.flush();
    expect(emit.mock.calls.map(([entry]) => entry)).toEqual([{ speaker: "HOST", text: "mm-hmm" }, { speaker: "CALLER", text: "Well, I I think so." }]);
  });
});
