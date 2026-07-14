# AI Phone-In / Studio

A human-hosted AI phone-in studio: producers build fictional caller cards, hosts run a re-orderable live queue, AI callers use browser WebRTC audio, and an OBS browser source receives a privacy-filtered broadcast display. Shows can be configured for advice, discussion, stories, sport, competitions, entertainment, or a general call-in format.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set a strong `ADMIN_PASSWORD` and `AUTH_SECRET`. Do not set `DATABASE_URL` for the local PGlite runtime.
3. Run `npm install`, then `npm run db:generate` and `npm run db:local:init`.
4. Start the app with `npm run dev`, then sign in at `http://localhost:3000/login`.

`db:local:init` resets the development fixtures. Do not use it against a database whose data you need to keep.

## Running a call

1. Start the show, then use **Bring in first caller**.
2. The broadcast display changes to a compact **Coming up next** card. Press **Answer** only when you want that caller on air.
3. The Studio asks for microphone permission, connects the AI caller and the caller opens naturally before waiting for the host.
4. Press **End call**. The host hang-up sting plays and the next caller is immediately prepared on the broadcast display; no separate "call next guest" step is needed.
5. After the last caller, choose **Run all callers again** to reset the completed running order for another rehearsal. The same safe reset is available as **Requeue every caller** on the show page.

The Studio also offers a caller-hang-up control, automatic incoming/connection stings, optional cheer/horn/rimshot cues, manual prepared visuals, queue drag-and-drop, live transcript entries and caller output metering. The broadcast display receives the host Studio's live caller-output EQ signal, so its on-screen equalizer moves only when the caller audio does.

## Live producer workflow

Keep the **Host Studio** open for the presenter and the show detail page open for a producer (on another browser, computer, or tab). The producer can use **Create with AI workshop** or **Create manually**, approve a caller, then use the **Live producer lane** to add them to the end of the running order. Newly approved callers appear in that lane automatically while a show is live, and adding one updates the host queue immediately without interrupting the current caller.

## Live caller voice

Add `OPENAI_API_KEY` to `.env.local`, restart the development server, and open the Studio in Chrome or Edge at `http://localhost:3000` (or an HTTPS URL). A normal HTTP LAN/IP address cannot access a microphone.

The browser creates the WebRTC offer; the server performs the Realtime call negotiation with the permanent API key, which never reaches the browser. The caller's returned stream plays through the browser's native WebRTC audio output, while a separate silent monitor drives the caller-output meter. If a connection fails, the caller remains waiting and the host can retry **Connect AI caller** or select the explicit mock fallback.

Each caller has a selected OpenAI voice and delivery pace. The caller brief also controls their specificity, cadence and what they reveal. Existing development callers automatically map to distinct supported voices; use the caller editor to choose voices and pace deliberately for future callers.

### Optional ElevenLabs Agent route

For a different full-duplex conversational stack, add both `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` to `.env.local`, then restart the server. In **Show setup**, select **ElevenLabs Agent** as the live voice route, or temporarily switch routes from the Studio before connecting a caller. The app requests a short-lived server-side conversation token per active caller; it never exposes the ElevenLabs API key to the browser.

The configured ElevenLabs Agent receives the caller card and show-format brief as a per-session override. Add an optional **ElevenLabs voice ID** in the caller editor to vary caller voices; leave it blank to use the Agent default. Configure the Agent with normal two-way voice settings and, if you want prepared visual tool calls, a client tool called `show_caller_visual` that accepts an `assetId`.

Wear headphones during a live call and check the moving **Caller output** equalizer in both the Studio and broadcast display before treating a session as broadcast-safe.

## Caller workshop

The workshop is now a quick character-pack path: add a seed, scan six compact options, use **Build this caller**, then **Save and open editor**. Everything remains a private, editable draft: the detailed producer checklist and review notes are collapsed until they are useful, while approval and queueing stay deliberate actions. The generator follows the show direction in your seed and is no longer limited to comedy.

The caller editor has three visual routes: select an offline DiceBear SVG avatar from six swappable styles, use an existing portrait URL, or create an original AI image. DiceBear avatars are stored as data URIs with the caller, so they remain stable on the broadcast display without a third-party image host.

## Stock and AI image feed

The caller editor includes **On-air image feed**. Add one or both of these keys to `.env.local`, restart `npm run dev`, then search directly from a caller page:

- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`

The search key stays server-side. Choose a topic image, add it to the caller's prepared-visual library, and switch it on from the Studio. The broadcast keeps the caller identity/portrait card and shows the chosen topic image in its own on-air module. A producer can also use **AI image generator** in the caller editor to create an original portrait or Prepared visual using `OPENAI_API_KEY`; generated images are low-quality drafts by default to control cost. Review each provider's current licence and attribution requirements before a public broadcast.

## Validation

Run:

```powershell
npm run lint
npm test
npm run verify:realtime
```

`verify:realtime` checks server-side Realtime configuration without sending microphone audio. A real browser/headset rehearsal is still required before broadcast use.

## OBS

Open the broadcast display link from a show page and add it as a 1920×1080 OBS Browser Source. Use `mode=full` for the complete display or `mode=overlay` for a transparent lower third. Capture the host microphone separately and capture the Studio browser application audio for callers and cues.
