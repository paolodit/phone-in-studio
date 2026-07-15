# AI Phone-In / Studio

AI Phone-In / Studio is a local-first production toolkit for running live, human-hosted shows with fictional AI callers.

Producers create and approve caller cards, arrange a running order, prepare visuals and keep adding callers while a show is live. The host talks to each caller through browser-based voice audio, while a separate privacy-filtered display is suitable for OBS, Twitch, TikTok Live Studio, Kick or another streaming workflow.

The format is deliberately general: it can support advice shows, audience stories, sports discussion, opinion, competitions, entertainment or a custom phone-in—not only comedy.

> **Project status:** usable local development build. The core producer, host, AI voice and broadcast-display workflows work, but this is not yet a hardened multi-user production service. Read [Current limitations](#current-limitations) before using it on a public stream.

## What is working

- Multiple show workspaces, each with its own format, running order, Studio, voice route, sound cues and private broadcast URL.
- AI-assisted caller workshop that turns a seed into six directions and then into an editable caller card.
- Manual caller creation, approval, archiving filters, topic tags, selectable avatars, stock visuals and OpenAI image generation.
- Drag-and-drop running orders, caller reactivation and live queue additions from a second producer tab.
- OpenAI Realtime browser voice with live host/caller meters and transcripts.
- Optional ElevenLabs Conversational AI routing with per-caller voice IDs.
- A private caller soundcheck and separate test output that do not touch the live queue or production broadcast.
- Automatic incoming, connected and hang-up tones, plus optional host-triggered soundboard cues.
- A full-screen broadcast display with caller graphics, manually selected topic visuals and caller-output EQ.
- Privacy-filtered public snapshots: private caller notes, hidden story details and permanent API keys never enter the broadcast payload.

## How the product is organised

There are three main working surfaces:

1. **Callers** — create, edit, approve and privately soundcheck reusable fictional callers.
2. **Shows** — configure a programme and manage its running order, sound cues and broadcast link.
3. **Studio** — the host-facing live controls, caller audio, transcript, visuals, soundboard and queue.

The **broadcast display** is a separate tokenised route intended for OBS or another browser-source capture. The **private caller test output** is deliberately separate, so testing a voice cannot disturb a show that is already on air.

## Quick start

### Prerequisites

- Node.js 20 or newer (Node 22 is recommended).
- npm.
- Chrome or Edge for live microphone/WebRTC testing.
- An OpenAI API key for AI caller generation, image generation and OpenAI Realtime voice.

### First local run

```powershell
git clone https://github.com/paolodit/phone-in-studio.git
cd phone-in-studio
npm install
Copy-Item .env.example .env.local
npm run db:generate
npm run db:local:init
npm run dev
```

Before starting, edit `.env.local` and replace at least:

```dotenv
ADMIN_PASSWORD=choose-a-local-admin-password
AUTH_SECRET=choose-a-long-random-secret
OPENAI_API_KEY=your-server-side-openai-key
```

Then open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_PASSWORD`.

`npm run db:local:init` applies migrations and **resets the local development fixtures**. Use it for first-time setup or an intentional reset—not as a normal start command when you want to keep your current local shows and callers.

For later sessions, normally run only:

```powershell
npm run dev
```

The development command starts the project’s detached local PostgreSQL runtime and Next.js together. Do not set `DATABASE_URL` in `.env.local` for this local workflow; the script supplies its own local connection.

## Environment variables

All service credentials remain server-side. Never commit `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | Password for the current local admin login. |
| `AUTH_SECRET` | Yes | Signs the HTTP-only admin session cookie. Use a long, unique random value. |
| `OPENAI_API_KEY` | Recommended | Caller Workshop, OpenAI Realtime voice and AI image generation. |
| `OPENAI_REALTIME_MODEL` | No | Realtime model override. Defaults to `gpt-realtime-2.1`. |
| `OPENAI_CALLER_GENERATION_MODEL` | No | Caller Workshop model override. Defaults to `gpt-5.4-mini`. |
| `OPENAI_IMAGE_MODEL` | No | Image model override. Defaults to `gpt-image-2`. |
| `ELEVENLABS_API_KEY` | No | Enables the ElevenLabs Conversational AI route. |
| `ELEVENLABS_AGENT_ID` | No | The ElevenLabs Agent used for caller conversations. |
| `PEXELS_API_KEY` | No | Enables Pexels stock-image search. |
| `PIXABAY_API_KEY` | No | Enables Pixabay stock-image search or provider fallback. |
| `DATABASE_URL` | Production only | PostgreSQL connection for a non-local deployment. Leave unset for `npm run dev`. |

Restart `npm run dev` after changing environment variables.

## Recommended producer workflow

### 1. Create or develop a caller

Open **Callers** and choose either:

- **Develop with AI** — describe a situation, opinion, story, prop or dilemma; compare six directions; build one; then save it as an editable draft.
- **Create manually** — enter a caller card directly.

The AI workshop does not silently publish anything. A generated caller remains a private draft until a producer reviews and approves it.

### 2. Review the caller card

The public caller identity and issue are visible first. Edit only what needs changing. Private story mechanics, host prompts and optional producer checks remain available without blocking a quick workflow.

For caller graphics, use one of the following:

- a stored DiceBear avatar;
- a custom portrait URL;
- an OpenAI-generated portrait;
- topic images from Pexels or Pixabay;
- an OpenAI-generated prepared visual.

Only approved callers can enter a show running order.

### 3. Test the voice privately

From a caller page, choose **Test voice privately**.

The private soundcheck can use OpenAI Realtime or ElevenLabs, shows both microphone and caller-output meters, and keeps a temporary test transcript. **Open test output** provides a separate presentation screen for checking graphics and caller EQ.

This mode sends `testMode` to the voice API. It does not require an active show caller and does not update a show, queue item, production event log or live broadcast display.

Use headphones. Let the caller deliver their opening line, speak naturally, then pause for the reply. Check voice, pacing, interruption behaviour and output level before adding the caller to a programme.

### 4. Create a show workspace

Open **Shows**, choose **New show**, and set the programme title. Inside the show workspace you can:

- select a general, advice, discussion, stories, sports, competition or entertainment format;
- add custom AI-caller guidance;
- choose OpenAI Realtime or ElevenLabs as the voice route;
- add approved callers and drag them into order;
- add custom soundboard URLs and hotkeys;
- open the Host Studio and tokenised broadcast display.

Show setup is intentionally lightweight. Callers do not need rehearsal passes before a live phone-in; private caller soundchecks are available when a producer wants them.

### 5. Run the show

1. Open the show in **Studio** and press **Start show**.
2. Bring in the first caller. The broadcast changes to a smaller **Coming up next** state.
3. Press **Answer** when the host is ready.
4. Connect the selected AI voice route when prompted. The caller opens the conversation naturally.
5. The host speaks, pauses for the reply, and can interrupt, mute, hold, resume or end the caller.
6. **End call** plays the host hang-up tone and automatically prepares the next caller on the broadcast display.
7. After the final caller, use **Run all callers again** or **Requeue every caller** if the running order should be reusable.

There is no redundant “call next guest, then answer” cycle after ending a call. The next caller is prepared automatically, while the host still chooses the exact moment they go on air.

## Two-producer live operation

Keep the **Studio** open for the host and the relevant **show workspace** open for a producer in another tab or computer.

While the host continues the current call, the producer can create and approve new callers, then add them to the end of the running order. The Studio refreshes the queue without interrupting live caller audio. Queued callers can be reordered by dragging; completed callers can be reactivated and returned to the order.

This is currently a shared-database workflow rather than true collaborative presence: there are no producer cursors, edit locks or conflict warnings yet.

## Voice routing

### OpenAI Realtime

The browser captures the host microphone and creates a WebRTC offer. The server negotiates the Realtime call using `OPENAI_API_KEY`; the permanent key is never sent to the browser.

Each caller can have a supported OpenAI voice and pacing setting. The caller card also controls speech style, average response length, interruption behaviour, what the caller wants and what they initially conceal.

Live microphone access requires one of:

- `http://localhost:3000` on the same computer; or
- an HTTPS deployment.

A normal `http://192.168.x.x` or other LAN/IP URL is not a secure browser context and cannot use `getUserMedia`.

### ElevenLabs Conversational AI

Set both `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`, restart the app, then select **ElevenLabs Agent** in Show options or the private caller soundcheck.

The server requests a short-lived conversation token for each connection. Caller instructions are passed as a session override, and an optional per-caller ElevenLabs voice ID can override the Agent default.

If you want an ElevenLabs Agent to request prepared visuals, configure a client tool called `show_caller_visual` that accepts an `assetId`. Manual Studio visual triggering works without that tool.

## Broadcast output and OBS

Open **Broadcast output** from a show workspace. The URL contains an unguessable show token; treat it as private.

Recommended OBS setup:

1. Add the show URL as a Browser Source.
2. Start with a 1920 × 1080 source for the full layout.
3. Use `mode=full` for the complete display.
4. Use `mode=overlay` for a transparent overlay/lower-third treatment.
5. Capture the host microphone separately.
6. Capture the Studio browser/application audio for AI callers and sound cues.

The broadcast page does not emit the host microphone. Its caller EQ is driven by the caller-output signal reported by the Studio, so it should move only while the AI caller is producing audio.

The full display is responsive, but platform-specific 9:16 and other social presets still need dedicated layout controls and validation before being treated as finished templates.

## Images and prepared visuals

Add `PEXELS_API_KEY`, `PIXABAY_API_KEY`, or both to search for topic imagery from a caller page. When both are configured, the automatic provider route prefers Pexels and can fall back to Pixabay.

A producer chooses which prepared visual reaches the broadcast; visuals do not auto-publish merely because they were added to a caller. Provider credit is stored with the result and should be retained where the provider’s terms require it.

OpenAI image generation uses low-quality draft output by default to control development cost. Review every generated or stock image for suitability, rights and broadcast safety before going live.

## Sound cues and shortcuts

Incoming, connection and host hang-up tones run automatically. The Studio also includes optional cheer, horn, rimshot and caller-hang-up triggers. Custom URL-based audio cues and their hotkeys are configured per show.

The Studio displays shortcut labels beside the relevant controls. Avoid typing into form fields when using global shortcuts; keyboard commands are ignored while an input, textarea or select has focus.

## Data, privacy and security

- `.env.local` is server-only and must not be committed.
- The admin session is stored in an HTTP-only, signed cookie with a 12-hour lifetime.
- OpenAI and ElevenLabs permanent keys are never returned to the browser.
- The broadcast API exposes only the caller’s public identity, public issue, caller graphic and currently selected visual.
- Hidden truths, private producer notes and full caller mechanics stay in the authenticated Studio.
- Local shows and callers are stored in the project’s detached development PostgreSQL database.
- `npm run db:local:init` destroys and recreates the development fixtures.

For a public deployment, replace the single shared admin login with proper user accounts, role enforcement, audit controls, secret management, TLS and managed PostgreSQL backups.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local database if needed and runs Next.js development mode. |
| `npm run db:generate` | Regenerates the Prisma client. |
| `npm run db:local:init` | Applies migrations and resets local fixtures. Destructive to local development data. |
| `npm run db:local:stop` | Stops the detached local database runtime. |
| `npm run lint` | Runs the TypeScript no-emit check. |
| `npm test` | Runs the Vitest suite. |
| `npm run verify:local` | Creates an isolated temporary show and verifies the mocked show-state flow, visuals, event persistence and privacy filtering. |
| `npm run verify:realtime` | Requests a temporary OpenAI Realtime session credential to verify server configuration; it does not send microphone audio. |
| `npm run build` | Creates a production Next.js build. Stop the development server first. |

## Troubleshooting

### The app cannot reach `127.0.0.1:51214`

The detached local database is not running. Stop any stale runtime and start the app again:

```powershell
npm run db:local:stop
npm run dev
```

If this is a new checkout, run `npm run db:local:init` once before `npm run dev`.

### The microphone is unavailable

- Use Chrome or Edge.
- Open exactly `http://localhost:3000`, not a plain HTTP LAN address.
- Allow Microphone in the browser’s site controls.
- Close other applications that may have exclusive control of the device.
- Use the in-app retry after changing permission.

### The caller connects but cannot be heard

- Check the caller volume slider and the selected operating-system output device.
- Confirm the **Caller output** meter is moving.
- Use headphones to prevent the caller hearing itself through the host microphone.
- End and reconnect the voice session; every attempt creates a fresh short-lived credential.
- Use the mock speaker line to distinguish an output-device problem from a provider connection problem.

### ElevenLabs cannot start a caller

Confirm that both the API key and Agent ID belong to the same ElevenLabs account and that the Agent supports WebRTC conversations. Restart the app after editing `.env.local`.

### Stock images are unavailable

Add at least one stock-provider key, restart the app, and try a broader topic query. The application does not expose those keys to the client.

## Project structure

```text
app/                  Next.js pages, authenticated APIs and broadcast routes
components/           Studio, caller workshop, test output and broadcast UI
lib/                  show state, prompts, voice providers, auth and integrations
prisma/               schema, migrations and development fixtures
scripts/              local database startup and verification tools
tests/                state, queue, prompt, generation and voice configuration tests
public/               bundled caller and interface assets
```

## Current limitations

- Local-first single-admin authentication; the database roles are not yet exposed as complete user-management workflows.
- No true telephone/SIP or PSTN gateway. “Callers” are browser-connected AI voice sessions.
- Multi-producer use shares live database state but has no presence indicators, edit locks or conflict resolution.
- No automatic cloud deployment, managed database, backups or secret-store configuration yet.
- OBS/platform output presets still need explicit 9:16, 1:1 and safe-area controls.
- Provider availability, pricing and model names can change; verify them before production use.
- Generated and stock media still require human editorial, licensing and safety review.
- A real browser/headset soundcheck remains necessary before every public broadcast.

## Validation before a stream

```powershell
npm run lint
npm test
npm run verify:local
npm run verify:realtime
```

Then open one caller’s **private soundcheck**, verify microphone and caller-output meters, listen through the intended streaming audio path, and preview the actual tokenised broadcast URL in the target scene.

---

Made with ❤️ by [Two Guys One Cat](https://www.twoguysonecat.com).
