import dotenv from "dotenv";
import WebSocket from "ws";
import { randomBytes } from "node:crypto";
import type { Caller } from "../generated/prisma/client";
import { buildOpenAILiveSessionConfig } from "../lib/openai-live-session";
import { hangupOpenAILiveSession } from "../lib/openai-live-close";
import { openaiLiveCallRequestSchema } from "../lib/schemas";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

if (!process.argv.includes("--allow-billable")) {
  console.log("Opt-in API check: npm run verify:live -- --allow-billable\nCreates two short billable GPT-Live sessions with synthetic silence, not your microphone. No audio is saved or played.\nAdd --webrtc to check just one audio-free WebRTC offer instead (15-second initialization charge).");
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");

const caller = {
  firstName: "Robin", location: "Cardiff", occupation: "Librarian",
  issueHeadline: "Our book club never agrees on the next book",
  openingSummary: "A fictional caller wants a fair way to choose a book together.",
  character: { centralWant: "Find a fair compromise", speechStyle: "Warm and conversational" },
  story: {}, performance: { voicePresentation: "any", voiceId: "marin" },
} as unknown as Caller;

async function verifyWebRtcOffer() {
  const fingerprint = randomBytes(32).toString("hex").match(/../g)!.join(":").toUpperCase();
  // Negotiation-only fixture: no peer, microphone, real ICE candidates or audio.
  const sdp = [
    "v=0", "o=- 123456789 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0 1", "a=msid-semantic: WMS diagnostic",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111", "c=IN IP4 0.0.0.0", "a=rtcp:9 IN IP4 0.0.0.0",
    "a=ice-ufrag:diagnostic", "a=ice-pwd:diagnostic-password-123456789", `a=fingerprint:sha-256 ${fingerprint}`,
    "a=setup:actpass", "a=mid:0", "a=sendrecv", "a=rtcp-mux", "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1", "a=msid:diagnostic audio",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
    "a=ice-ufrag:diagnostic", "a=ice-pwd:diagnostic-password-123456789", `a=fingerprint:sha-256 ${fingerprint}`,
    "a=setup:actpass", "a=mid:1", "a=sctp-port:5000", "a=max-message-size:262144", "",
  ].join("\r\n");
  const request = openaiLiveCallRequestSchema.parse({ callerId: "diagnostic", showId: "diagnostic", testMode: true, sdp });
  if (request.sdp !== sdp) throw new Error("Request validation modified the browser SDP.");
  let sessionId: string | undefined;
  try {
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session: buildOpenAILiveSessionConfig(caller), transport: { type: "webrtc", sdp: request.sdp } }),
      signal: AbortSignal.timeout(25_000),
    });
    const result = await response.json();
    sessionId = typeof result.session?.id === "string" ? result.session.id : undefined;
    if (!response.ok) throw new Error(`WebRTC negotiation failed: HTTP ${response.status}, ${result.error?.code ?? "unknown"}.`);
    if (!sessionId || typeof result.transport?.sdp !== "string" || !result.transport.sdp.startsWith("v=0")) throw new Error("Missing WebRTC session ID or SDP answer.");
    console.log(JSON.stringify({ transport: "webrtc", status: response.status, sdpPreserved: request.sdp === sdp, answerReceived: true }));
  } finally {
    if (sessionId) {
      const closed = await hangupOpenAILiveSession(sessionId).catch(() => false);
      console.log(JSON.stringify({ transport: "webrtc", shutdownConfirmed: closed }));
      if (!closed) throw new Error("WebRTC test shutdown unconfirmed. Check the API project's active sessions.");
    }
  }
}

if (process.argv.includes("--webrtc")) {
  await verifyWebRtcOffer();
  console.log("WebRTC offer validation passed. This checks the session handshake, not browser media playback.");
  process.exit(0);
}

async function verifyVoice(voice: string) {
  const config = buildOpenAILiveSessionConfig(caller, undefined, voice);
  // Reuse the caller/voice configuration; a primary WebSocket has no WebRTC data channel.
  const { client: _dataChannelPermissions, ...socketConfig } = config;
  const socket = new WebSocket("wss://api.openai.com/v1/live/sessions", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, handshakeTimeout: 12_000,
  });
  let sessionId: string | undefined;
  let finalized = false;
  let closing = false;
  let audioBytes = 0;
  let textCharacters = 0;
  let resolvedVoice: string | undefined;
  let failure: Error | undefined;
  let input: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let outputTimer: ReturnType<typeof setTimeout> | undefined;
  const send = (event: unknown) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); };
  const finish = () => {
    if (closing) return;
    closing = true; clearInterval(input); clearTimeout(deadline); clearTimeout(outputTimer);
    if (sessionId) send({ type: "session.close" });
    else socket.terminate();
    finishTimer = setTimeout(() => socket.terminate(), 5000);
  };
  try {
    await new Promise<void>((resolve) => {
      deadline = setTimeout(() => { failure = new Error("Session startup or audio timed out."); finish(); }, 30_000);
      socket.on("open", () => send({ type: "session.start", event_id: "smoke-start", session: { ...socketConfig, audio: { ...config.audio, format: { type: "audio/pcm", rate: 24000 } } } }));
      socket.on("error", (error) => { failure = error; });
      socket.on("close", () => resolve());
      socket.on("message", (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === "session.started") {
          sessionId = event.session.id; resolvedVoice = event.session.audio?.output?.voice;
          // 100 ms mono PCM16 at 24 kHz, paced like a live input stream.
          input = setInterval(() => send({ type: "session.input_audio.append", audio: Buffer.alloc(4800).toString("base64") }), 100);
          send({ type: "session.instructions.append", event_id: "smoke-opening", delegation_id: null, content: "Speak English. You are connected to the host. Open immediately with a short natural first-person line about your book club. Do not wait for the host." });
        } else if (event.type === "session.instructions.appended" && event.client_event_id === "smoke-opening") {
          send({ type: "session.commentary.append", event_id: "smoke-begin", delegation_id: null, content: "Begin the call now, following the opening instructions." });
        } else if (event.type === "session.output_audio.delta") {
          audioBytes += Buffer.from(event.delta, "base64").length;
          if (audioBytes >= 48000 && !outputTimer && !closing) outputTimer = setTimeout(finish, 1500);
        } else if (event.type === "session.output_transcript.delta") textCharacters += event.delta.length;
        else if (event.type === "session.closed") { finalized = true; socket.close(); }
        else if (event.type === "error") { failure = new Error(`Live API error: ${event.error?.code ?? event.error?.type ?? "unknown"}: ${event.error?.message ?? "request rejected"}`); finish(); }
      });
    });
  } finally {
    clearInterval(input); clearTimeout(deadline); clearTimeout(finishTimer); clearTimeout(outputTimer);
    socket.terminate();
    if (sessionId && !finalized) {
      const hungUp = await hangupOpenAILiveSession(sessionId).catch(() => false);
      if (!hungUp) console.error("Shutdown unconfirmed: check the API project's active sessions.");
    }
  }
  console.log(JSON.stringify({ requestedVoice: voice, resolvedVoice, audioBytes, textCharacters, finalized }));
  if (failure) throw failure;
  if (!finalized || resolvedVoice !== voice || audioBytes < 48000) throw new Error("Expected matching voice, at least one second of audio and confirmed session closure.");
}

for (const voice of ["willow", "vesper"]) await verifyVoice(voice);
console.log("GPT-Live API smoke check passed for two distinct voices. Browser/device soundcheck is still required.");
