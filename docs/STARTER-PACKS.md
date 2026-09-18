# Starter packs: authoring and lifecycle

## Current editorial boundary

The flow is implemented, but the product casts are intentionally **not invented**. Three human packs await six curated guests each. The single auto-run pack awaits its theme, presenter and five guests. `editorialStatus` and server validation prevent incomplete packs from creating empty or misleading channels.

## Source of truth

- `lib/starter-packs.ts`: IDs, versions, pack names/descriptions, format instructions, independent cast, portraits, image queries/curated images, optional presenter and media/hosting defaults.
- `lib/channel-creation-options.ts`: public entry labels and default human-hosted choice.
- `lib/channel-creation.ts`: validates and copies a pack, prepares media before the transaction, then atomically creates a Show, caller copies, queue snapshots and optional presenter/module settings.
- `lib/channel-deletion.ts`: exact-name confirmation, conditional non-live deletion and relationship handling.

The UI receives only public menu metadata. It does not import private stories or presenter instructions.

## Completing a pack

1. Add exactly six `StarterGuest` definitions for a human pack, or five for auto. IDs must be unique **within that pack**.
2. Each guest uses the existing `CallerFormInput`: identity, issue, opening, motivations, withheld detail, speaking style, voice and host questions. Keep the cast independent—no shared narrative variables, required relationships or awareness of other guests. Keep `portraitUrl` out of this form when using a relative local asset; the separate `portrait` field owns that image.
3. Supply `portrait: { url, label, creditText?, creditUrl? }` using existing caller imagery. Supply an editorially specific `imagery.query`, or `imagery.images` with curated image URLs and creator credits. Use actual image sources; do not invent attribution or treat a stock person as the subject of a fictional allegation.
4. The auto pack also needs a confirmed name/description, show instructions and a `StarterPresenter`. Its profile is copied on creation. Existing profiles and other shows are not overwritten.
5. Use one of the bundled music IDs in `public/audio/catalog.json`. Music and image autoplay are on by default. Defaults live in copied `Show.brandingConfig`; there is no continuous template synchronization.
6. Set `editorialStatus: "ready"` only after reviewing the complete pack. Increment `version` for future template changes. Previously created channels keep their content.
7. Run `npm run lint`, `npm test` and, with the local database running, `npm run verify:channels`.

Image search uses the existing configured Pexels/Pixabay source with bounded requests. Creator name and source page are preserved in assets and queue snapshots. A failed search leaves the portrait and records a visible creation warning; existing caller media tools can add images later. No stock or voice calls occur merely from opening the menu.

## Playback and deletion

Creating a pack never goes on air or starts the AI host. Music starts only from the normal explicit Studio Start/Answer or Start auto-run action; browsers may require sound permission. Stop disables automatic music for that channel in this browser. Image autoplay follows the existing per-show clock and caller-state behavior.

Deletion removes the selected Show and cascaded queue/events/custom cues/module settings. The conditional database delete refuses a show that became live or was renamed after confirmation. Library callers/assets and presenter profiles are retained, including those originally copied from packs; they may be reused elsewhere. Candidate batches become unassigned. An accepted ShowPlan becomes a draft again. Local recordings are not server rows and remain accessible through their original recordings route even after channel removal.

`verify:channels` creates its own randomly named local database schema, applies migrations there, uses a clearly test-only fixture cast, verifies copy isolation/media/host defaults and deletion relationships, then removes only that schema. It never uses the user's real channels or makes provider calls. The schema is explicit because the embedded local PostgreSQL runtime does not isolate databases by name in the usual way.
