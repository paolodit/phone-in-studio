# GPT-Live-1 in Phone-In Studio

An optional caller voice route for continuous, full-duplex conversations. Existing shows, caller casting and the Realtime 1.5 default remain unchanged.

## Try it

1. Keep `OPENAI_API_KEY` in `.env.local`. Your OpenAI project needs GPT-Live access. `OPENAI_LIVE_MODEL` is optional and defaults to `gpt-live-1`.
2. Open a caller's **Test voice privately** soundcheck. Choose **OpenAI GPT-Live-1 (full duplex)**.
3. Leave **Audition a GPT-Live voice** on the saved match or select another of the 22 voices. Auditions never save a caller or change the live show.
4. Start the test with headphones. Let the caller open, then have a normal conversation. End the test before choosing another voice.
5. Save a preferred voice under **Edit caller → Voice and delivery → GPT-Live voice**, then select the route in Show options or Studio's audio setup.

Voice-presentation metadata is casting guidance, not a statement about the character's identity. Saved choices must match feminine, masculine or neutral preferences; **Any** preserves an exact choice. The private audition selector intentionally bypasses matching so you can compare every voice. Existing voice IDs are mapped compatibly when no GPT-Live override is saved.

## What changed under the hood

| Concern | Live implementation |
| --- | --- |
| Connection | The authenticated server posts JSON session configuration and gathered WebRTC SDP to `/v1/live/sessions`. SDP is preserved byte-for-byte, including its final CRLF; trimming it causes an `invalid_offer` / EOF rejection. Permanent credentials never reach the browser. |
| Startup | Register `oai-events` before creating the offer. Wait for `session.started`, append concise English opening instructions, wait for their acknowledgement, then append a short opening cue. No second `session.start` over WebRTC. |
| Conversation | Continuously stream microphone audio. No Realtime VAD, response creation/cancellation loop or automatic microphone gate. |
| Caller identity | A bounded prompt contains identity, premise, motivation, private story and speech style. Old strict turn-taking instructions are not copied across. |
| Voices | 22 documented built-ins, including 12 new regional options. Voice and model are fixed for a session. |
| Transcripts | Separate input/output deltas are accumulated without trimming away spaces or repetitions. Small UI batches are not treated as completed voice turns. |
| Speaking and EQ | Measure the actual remote audio stream. Live has no output-audio-done event. Transcript arrival and command acknowledgements are not playback completion. |
| Producer controls | Short `session.instructions.append` commands; quoted host context uses `session.thinking.append`. No unsupported `response.cancel` or `response.create` voice commands. |
| Deliberate cut-in | Immediately mute local caller playback, ask the model to yield, and re-arm after measured remote silence. This is not guaranteed remote cancellation. |
| Privacy | Private soundchecks do not query or mutate a show's queue. Production startup checks the active caller. `store: false` disables API recording; local recording remains an independent explicit action. |
| Shutdown | Request `session.close`, receive `session.closed`, release hardware. An authenticated, session-scoped signed token supports server hangup if the transport fails or the page closes. |

The caller has no external tools, web research or real-world actions. The existing optional AI presenter remains on its separate text/TTS path; GPT-Live receives its spoken-turn text through the existing adapter interface.

## Cost and failure behaviour

Live bills connected duration, including silence, input mute and hold. **End test / End call** releases the session; muting the caller is not a cost stop. The browser warns if fallback shutdown cannot be confirmed. Network loss can prevent graceful final usage delivery, so do not leave failed sessions unattended.

The adapter deliberately does not fall back to another provider without the host choosing it. Access, rate-limit and startup failures keep the caller/show data intact and report an actionable error. An app restart is needed only when environment settings change; no schema migration is required for this adapter.

## Verification

Offline checks:

```powershell
npm run lint
npm test
```

Optional **billable** API smoke check:

```powershell
npm run verify:live -- --allow-billable
```

This opens two short sessions with Willow and Vesper using the same caller prompt and voice resolver. A server-side WebSocket streams paced synthetic silence and checks returned voice identity, audio bytes and confirmed closure. It uses no real caller records, microphone, audio files or playback. WebRTC-only data-channel permissions are omitted for this diagnostic transport. Without the flag, the command prints instructions and makes no API call.

To check the WebRTC request path separately:

```powershell
npm run verify:live -- --allow-billable --webrtc
```

This passes a synthetic SDP offer through the app's real request validator and session configuration, checks that OpenAI returns an SDP answer, and immediately hangs up. It incurs the 15-second initialization charge and does not connect a microphone or media peer. Regression tests also check that the HTTP route forwards SDP unchanged in both directions.

These checks prove API access, request acceptance and (for the WebSocket test) audio delivery, **not** subjective voice quality, actual browser/device playout, end-to-end latency or resistance to room noise. Before going live, test:

- a fresh connection and natural opening without host prompting;
- a complete host question, a hesitant pause, an overlapping “uh-huh”, and a deliberate “wait”;
- Space interruption, caller mute/unmute, hold/resume and microphone switching;
- each selected caller voice in the actual recording/OBS audio path;
- caller meter and output EQ during speech and silence;
- End call, page navigation and an interrupted network connection;
- AI Host supervised mode separately before attempting auto-run.

## Official references

- [Live overview and voices](https://developers.openai.com/api/docs/guides/live)
- [Live prompting](https://developers.openai.com/api/docs/guides/live-prompting)
- [WebRTC transport](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
- [Session lifecycle and controls](https://developers.openai.com/api/docs/guides/live-conversations)
- [Migrating from Realtime](https://developers.openai.com/api/docs/guides/live-migration)
