import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIWebRtcVoiceProvider } from "@/lib/voice/openai-webrtc-provider";

class AudioNodeStub {
  fftSize = 256;
  frequencyBinCount = 128;
  gain = { value: 1 };
  connect() { return this; }
  disconnect() {}
  getByteTimeDomainData(values: Uint8Array) { values.fill(128); }
  getByteFrequencyData(values: Uint8Array) { values.fill(0); }
}
class AudioContextStub {
  static last: AudioContextStub;
  destination = new AudioNodeStub();
  close = vi.fn(async () => undefined);
  constructor() { AudioContextStub.last = this; }
  async resume() {}
  createAnalyser() { return new AudioNodeStub(); }
  createGain() { return new AudioNodeStub(); }
  createMediaStreamSource() { return new AudioNodeStub(); }
}
class PeerStub {
  static last: PeerStub;
  connectionState = "new";
  onconnectionstatechange?: () => void;
  events = { readyState: "connecting", onopen: undefined as (() => void) | undefined, onmessage: undefined as ((event: { data: string }) => void) | undefined, send: vi.fn(), close: vi.fn() };
  sender = { track: { kind: "audio" }, replaceTrack: vi.fn(async (_track: unknown) => undefined) };
  close = vi.fn();
  constructor() { PeerStub.last = this; }
  createDataChannel() { return this.events; }
  addTrack() { return this.sender; }
  getSenders() { return [this.sender]; }
  async createOffer() { return { sdp: "test-offer" }; }
  async setLocalDescription() {}
  async setRemoteDescription() { this.events.readyState = "open"; this.events.onopen?.(); }
  emit(event: Record<string, unknown>) { this.events.onmessage?.({ data: JSON.stringify(event) }); }
  sent() { return this.events.send.mock.calls.map(([data]) => JSON.parse(data as string).type); }
}

describe("OpenAI WebRTC adapter lifecycle", () => {
  const tracks: { enabled: boolean; stop: ReturnType<typeof vi.fn> }[] = [];
  const config = { callerId: "test-caller", showId: "test-show", instructions: "", voiceId: "marin" };
  beforeEach(() => {
    tracks.length = 0;
    vi.stubGlobal("window", { isSecureContext: true, location: { origin: "http://localhost:3000" } });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => {
      const track = { enabled: true, stop: vi.fn() }; tracks.push(track);
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    }) } });
    vi.stubGlobal("RTCPeerConnection", PeerStub);
    vi.stubGlobal("AudioContext", AudioContextStub);
    vi.stubGlobal("Audio", class { setAttribute() {} pause() {} async play() {} });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sdp: "test-answer" }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens only when the event channel is ready and uses real WebRTC playback events", async () => {
    const playback = vi.fn();
    const session = await new OpenAIWebRtcVoiceProvider().createSession({ ...config, onPlaybackChange: playback });
    const peer = PeerStub.last;
    expect(peer.sent()).toEqual(["response.create"]);
    peer.emit({ type: "response.created" }); peer.emit({ type: "output_audio_buffer.started" });
    expect(playback).toHaveBeenLastCalledWith(true);
    peer.emit({ type: "input_audio_buffer.speech_started", item_id: "a" });
    peer.emit({ type: "input_audio_buffer.speech_stopped", item_id: "a" });
    peer.emit({ type: "input_audio_buffer.committed", item_id: "a" });
    peer.emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "a", transcript: "uh huh" });
    expect(peer.sent()).toEqual(["response.create"]);
    peer.emit({ type: "input_audio_buffer.speech_started", item_id: "b" });
    peer.emit({ type: "conversation.item.input_audio_transcription.delta", item_id: "b", delta: "Wait" });
    expect(peer.sent().slice(-2)).toEqual(["response.cancel", "output_audio_buffer.clear"]);
    peer.emit({ type: "output_audio_buffer.cleared" });
    expect(playback).toHaveBeenLastCalledWith(false);
    await session.endSession();
  });
  it("does not ask for a reply before the host audio is committed", async () => {
    const session = await new OpenAIWebRtcVoiceProvider().createSession(config);
    const peer = PeerStub.last; peer.emit({ type: "response.done" });
    peer.emit({ type: "input_audio_buffer.speech_started", item_id: "a" });
    peer.emit({ type: "input_audio_buffer.speech_stopped", item_id: "a" });
    expect(peer.sent()).toHaveLength(1);
    peer.emit({ type: "input_audio_buffer.committed", item_id: "a" });
    expect(peer.sent()).toEqual(["response.create", "response.create"]);
    await session.endSession();
  });
  it("releases the microphone and peer if negotiation fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network failed"); }));
    await expect(new OpenAIWebRtcVoiceProvider().createSession(config)).rejects.toThrow("Network failed");
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(PeerStub.last.close).toHaveBeenCalledOnce();
    expect(AudioContextStub.last.close).toHaveBeenCalledOnce();
  });
  it("preserves microphone mute when switching devices", async () => {
    const session = await new OpenAIWebRtcVoiceProvider().createSession(config);
    await session.muteInput(true); await session.switchInputDevice("new-mic");
    expect(tracks[1].enabled).toBe(false);
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    await session.endSession(); await session.endSession();
    expect(tracks[1].stop).toHaveBeenCalledOnce();
  });
  it("cleans up a failed live connection and exposes reconnect state", async () => {
    const disconnected = vi.fn();
    const session = await new OpenAIWebRtcVoiceProvider().createSession({ ...config, onDisconnected: disconnected });
    PeerStub.last.connectionState = "failed"; PeerStub.last.onconnectionstatechange?.();
    expect(disconnected).toHaveBeenCalledOnce();
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    await session.endSession();
  });
  it("releases a microphone granted after the producer cancels", async () => {
    const abort = new AbortController(); abort.abort();
    await expect(new OpenAIWebRtcVoiceProvider().createSession({ ...config, signal: abort.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(tracks[0].stop).toHaveBeenCalledOnce();
  });
});
