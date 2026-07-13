# AI Phone-In

Phase 1 of a human-hosted comedy phone-in: production users can create fictional caller cards, manually approve them, add immutable queue snapshots to a show, operate a mocked caller sequence in Host Studio, and drive a privacy-filtered OBS Browser Source through Server-Sent Events.

The concise implementation plan is in [docs/implementation-plan.md](docs/implementation-plan.md). The mock workflow, browser WebRTC voice path, visual controls, soundboard and Caller Workshop are implemented; complete a headset rehearsal before using the live path on a broadcast.

## Local setup

1. Copy `.env.example` to `.env.local`, set a strong `ADMIN_PASSWORD` and `AUTH_SECRET`, and remove `DATABASE_URL` from that local file.
2. Install packages with `npm install`.
3. Run `npm run db:generate` and `npm run db:local:init`.
4. Start the application with `npm run dev` and sign in at `http://localhost:3000/login`.

`db:local:init` uses Prisma Dev's supported PGlite-backed PostgreSQL server to apply the checked-in migration and seed a persistent local development database. It does not require Docker or a machine-level PostgreSQL installation. The normal `DATABASE_URL` remains for production and other real PostgreSQL deployments; use `npm run db:migrate` against that database there. Rerunning `db:local:init` resets the development fixtures, so do not run it against a database containing work you want to retain. Run `npm run db:local:stop` when you want to shut down the detached local database.

The seed creates Mandy, Gareth, Denise, Colin and Rhys plus a five-caller development show. In Studio select **Start show → Next caller → Answer call**; the mock provider takes the call from connecting to live. Use **Mock speak**, **Interrupt**, **End call**, and then cue the next caller. This proves the incoming/live/interrupted/ended flow without any API usage.

Run `npm run verify:local` after seeding to exercise that complete mocked flow against the local database. It intentionally advances the development show, so run `npm run db:local:init` afterwards when you want to restore the fresh fixture state.

With an OpenAI key configured, `npm run verify:realtime` performs one no-audio session-credential handshake. It confirms the configured model is available without sending microphone audio or starting a caller response.

## Caller Workshop

Open **Callers → Develop with AI** to turn a producer's seed into six premise options, select one, and request a structured caller card. Generation is server-side, uses your `OPENAI_API_KEY` only after an explicit button click, and does not save anything until **Save as draft and edit** is selected. Saved workshop callers carry their seed, chosen premise, prompt version and review notes privately in their generation record.

Every workshop result starts as `DRAFT`. The existing editor remains the place to revise it and a producer must still approve it before it can be added to a show queue. The default `OPENAI_CALLER_GENERATION_MODEL` is `gpt-5.4-mini`; set the environment variable to a model available to your project if you want a different quality/cost trade-off.

Each caller card also has a producer review panel: four human checklist items, private production notes, workshop review notes (when applicable), and a rehearsal-pass counter. Logging a rehearsal moves an unapproved draft into `REHEARSING`; the producer still uses the separate **Approve caller** control when satisfied.

## Live caller voice (Phase 2)

The Host Studio now has a browser WebRTC voice provider. To enable it, add a server-side `OPENAI_API_KEY` to `.env.local` and restart `npm run dev`. `OPENAI_REALTIME_MODEL` defaults to the requested `gpt-realtime-2.1`; change it only if that exact model is not enabled for your API project.

On **Answer call**, the Studio asks for microphone permission, creates a short-lived Realtime client credential on the server, and negotiates browser-to-OpenAI WebRTC. The permanent key never enters browser code. It shows microphone/caller levels, lets the host select an input, control caller volume, mute, interrupt, end the session, and stores final host/caller transcript events in the show audit log. If no key is configured or negotiation fails, the same control sequence deliberately continues in mock mode.

Use `localhost` or HTTPS for microphone access, wear headphones, and verify the selected microphone before a live show. The current integration has been compiled and tested through its mock and database flow; it still needs a real API-key and headset rehearsal before broadcast use.

## First rehearsal runbook

1. Run `npm run db:local:init`, then `npm run dev`, and sign in at `http://localhost:3000/login`.
2. In **Callers**, either edit a seeded caller or choose **Develop with AI**. The AI route generates six options first; selecting and saving one creates only a private draft.
3. On the caller card, complete the human review checklist, add any prepared visuals, and use **Log rehearsal pass**. Make any card changes in the normal editor.
4. When a producer is content, use **Approve caller**. Only then will the caller appear in the show queue selector.
5. In **Shows**, create a running order, add approved callers, check the custom soundboard and copy/open the broadcast link in OBS.
6. In **Host Studio**, rehearse the mock route first: **Start show → Next caller → Answer call → Mock speak → End call**. Confirm the OBS Browser Source updates as you show and clear a visual.
7. For a live headset rehearsal, use the same flow with `OPENAI_API_KEY` present, allow microphone access, select the intended microphone, wear headphones, and verify the caller meter, transcript, interrupt and end-call controls before treating the session as broadcast-ready.

The automated checks do not make a microphone, headphones, browser audio routing or OBS scene safe. Those are deliberately checked in the rehearsal above.

The show page’s **Producer readiness** panel gives a compact preflight view of queue length, logged rehearsal passes, prepared visuals, custom audio cues and the OBS display link. It is a reminder layer, not an automated permission to broadcast.

## Visuals and soundboard

Each caller page has a supporting-visual library. Add prepared image URLs with labels, natural-language triggers and optional hotkeys, then queue a fresh snapshot of that caller. In Studio, clicking a visual immediately updates the OBS display; clearing the visual is also logged. Realtime sessions receive a narrow `show_caller_visual` tool whose asset IDs are limited to the active caller’s prepared visuals.

The show page includes a URL-based custom soundboard. Studio also has built-in incoming, connection, end-call and applause cues, so you can rehearse without external audio files. Custom cues play in the Studio browser, which is the audio source OBS should capture.

## OBS Phase 1 setup

From a show page, open **Open broadcast display**. Add that URL as an OBS Browser Source at 1920×1080. Use `mode=full` for the complete scene or change it to `mode=overlay` for a transparent lower-third style source. Keep the token in the URL private unless `broadcastPublic` is deliberately enabled in the database.

The broadcast browser source is visuals-only. During a live Realtime call, OBS should capture the host microphone separately and use Windows **Application Audio Capture** for the Studio browser's caller voice, stings and custom cues. Hosts should wear headphones to avoid echo.

## Quality and security guarantees in this phase

- Callers begin as drafts; a producer must explicitly mark them **Approved** before they can enter a show queue.
- Queue entries capture a caller snapshot, preserving the configuration used for a show.
- State transitions and events are persisted before an SSE update is sent.
- The public display reads only an allow-listed DTO; it cannot receive private notes, contradictions, hidden truths, host prompts or source material.
- Permanent OpenAI credentials remain server-side. The voice browser receives only a short-lived Realtime client credential, and Caller Workshop generation never sends the key to the browser.

## Validation

Run `npm test` for state-transition, prompt-construction and broadcast-privacy tests; run `npm run lint` for TypeScript checks; and run `npm run build` before deployment. `Dockerfile` uses `prisma migrate deploy` at startup and is compatible with a CapRover-style Node deployment when supplied with an external PostgreSQL `DATABASE_URL`.
