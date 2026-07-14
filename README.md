# AI Phone-In / Studio

A human-hosted comedy phone-in studio: producers build fictional caller cards, hosts run a re-orderable live queue, AI callers use browser WebRTC audio, and an OBS browser source receives a privacy-filtered broadcast display.

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

The Studio also offers a caller-hang-up control, automatic incoming/connection stings, optional cheer/horn/rimshot cues, manual prepared visuals, queue drag-and-drop, live transcript entries and caller output metering.

## Live caller voice

Add `OPENAI_API_KEY` to `.env.local`, restart the development server, and open the Studio in Chrome or Edge at `http://localhost:3000` (or an HTTPS URL). A normal HTTP LAN/IP address cannot access a microphone.

The browser creates the WebRTC offer; the server performs the Realtime call negotiation with the permanent API key, which never reaches the browser. If a connection fails, the caller remains waiting and the host can retry **Connect AI caller** or select the explicit mock fallback.

Each caller has a selected OpenAI voice and delivery pace. The caller brief also controls their specificity, cadence and what they reveal. Existing development callers automatically map to distinct supported voices; use the caller editor to choose voices and pace deliberately for future callers.

Wear headphones during a live call and check the moving **Caller output** equalizer before treating a session as broadcast-safe.

## Caller workshop

The workshop deliberately keeps the six generated premises as ideas until you select one and develop it. In the final review, select **Save and open editor**: it creates a normal private caller draft, then opens its editable caller page. The review displays a direct editor link as a fallback, so a completed save is never hidden if navigation is interrupted.

## Stock image feed

The caller editor includes **On-air image feed**. Add one or both of these keys to `.env.local`, restart `npm run dev`, then search directly from a caller page:

- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`

The search key stays server-side. Choose a topic image, add it to the caller's prepared-visual library, queue a fresh caller snapshot, and switch it on from the Studio. The broadcast keeps the caller identity/portrait card and shows the chosen topic image in its own on-air module. Review each provider's current licence and attribution requirements before a public broadcast.

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
