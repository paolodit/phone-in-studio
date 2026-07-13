# AI Phone-In implementation plan

## 1. Repository structure

`app/` holds the route surfaces and API endpoints; `components/` contains server-safe UI and client controls; `lib/` owns schemas, authentication, state transitions, event transport, prompt construction and voice-provider interfaces; `prisma/` owns the data model, migrations and development fixtures; `tests/` exercises pure production logic. Voice and storage are explicit provider boundaries rather than dependencies of studio components.

## 2. Database schema

The Phase 1 migration creates `User`, `Caller`, `CallerAsset`, `Show`, `QueueItem`, and append-only `ShowEvent` tables. Caller public identity and premise are relational columns; structured character, story, performance, host-support, generation and quality cards are JSON fields validated by Zod before writing. A `QueueItem` stores a caller snapshot so later caller edits cannot rewrite a past performance. `Show.broadcastToken` gates non-public broadcast routes.

## 3. State machine design

The Host Studio is authoritative. `Show.status` is lifecycle state; `Show.broadcastState` is the public scene. Pure, tested transitions permit `SHOW_IDLE → CALLER_INCOMING → CALLER_CONNECTING → CALLER_LIVE → CALLER_ENDED`, with hold, break, error and show-ended branches. The mock provider explicitly drives the connecting-to-live transition, so this sequence is testable without model access.

## 4. Real-time event architecture

Each accepted control action runs in a database transaction, persists an event, updates current state, builds a privacy-filtered snapshot, then publishes it through an SSE adapter. Connected studio and broadcast clients receive that snapshot immediately; a freshly loaded display fetches the current snapshot rather than replaying old stings. Phase 1 uses an in-process SSE publisher suitable for one Node instance; a later Redis/managed-pubsub adapter replaces only the publisher layer for horizontal scaling.

## 5. OpenAI Realtime integration approach

Phase 2 implements `LiveVoiceProvider` with a browser WebRTC provider for `gpt-realtime-2.1`. A server route creates short-lived Realtime client credentials from the permanent server-side key; browser code never receives that key. Structured caller data is transformed by `buildCallerInstructions`, and all model visual-tool arguments pass Zod validation plus live-caller asset checks. The Phase 1 `MockVoiceProvider` uses the same interface.

## 6. Audio-routing assumptions

The host wears headphones. The browser captures the selected host microphone only during an active call; caller model audio, stings and hold music play in the Studio browser. OBS captures host microphone independently and captures the Studio application audio separately. No server-side audio mixing or rebroadcast is required for the MVP.

## 7. OBS integration

`/broadcast/[showId]?mode=full` is a 16:9 full scene and `?mode=overlay` has a transparent background for a separately positioned OBS camera source. The route exposes only public caller fields. The access URL uses the unguessable broadcast token unless the show is intentionally marked public. SSE reconnect gives OBS a correct current scene after refresh.

## 8. Security boundaries

Studio, callers and show management require a signed admin session. Production secrets, including OpenAI credentials, remain server-side. Broadcast serialization is a deliberate allow-list; hidden truths, premises, notes, prompts, quality fields and source material never cross it. All server mutations validate inputs with Zod and public broadcast access is separately authorized.

## 9. Testing strategy

Vitest covers legal and illegal show transitions, prompt construction, and the public DTO privacy boundary. Later phases add provider contract tests, mocked Realtime/WebRTC failure paths, database integration tests, and Playwright flows for a three-caller rehearsal and OBS display reconnection.

## 10. Phase-by-phase file changes

Phase 1 adds the foundation now: routes, schema/migration, fixtures, auth, CRUD, queue, state machine, mock event transport and tests. Phase 2 adds `lib/voice/openai-realtime.ts`, ephemeral-token routes, device/audio controls, transcripts and recovery. Phase 3 extends Studio, broadcast and queue controls around persisted call records. Phase 4 adds storage adapters, asset controls and validated visual tools. Phase 5 adds development/rehearsal generation routes and revision history. Phase 6 adds production deployment, monitoring, multi-instance event transport and Playwright/OBS hardening.

## 11. Technical risks

The main risks are browser audio-device variance, WebRTC interruption latency, long-running SSE connections behind deployment proxies, model quality under interruption, and keeping a public broadcast strictly private-note-free. Audio is isolated behind a provider interface; events are persisted before publishing; the state machine and DTO boundary are tested from the first commit.

## 12. Material assumptions

Phase 1 targets a single trusted production admin and one Node instance. PostgreSQL is available locally through Docker and in production through a managed or CapRover-attached service. Portrait fixtures use generated gradients until the asset workflow arrives. The demonstration callers are transformed fictional fixtures only. No live OpenAI, voice cloning, image generation, or public registration is included in this phase.
