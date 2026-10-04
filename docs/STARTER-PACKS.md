# Starter packs: authoring and lifecycle

## Current editorial boundary

The three human-hosted packs are ready: **18 authored, independent guests**, each with a clear position, specific stakes, private turning points, host questions and a distinct voice within its pack. Bad Joke Hotline includes original prepared joke material, not just instructions to “be funny”. The single auto-run pack still awaits its theme, presenter and five guests; it remains visibly unavailable. `editorialStatus` and server validation prevent incomplete packs from creating empty channels.

| Pack | Cast and conversation hooks |
| --- | --- |
| Am I the A\*\*hole? | Mina invoices her siblings for caring for Mum; Dev excludes a late-paying friend from a raffle win; Ella edits a reconciled ex out of wedding photos; Jonah uses dog custody to avoid his breakup; Rachel weaponises an honest café review; Sam's family tech-support strike becomes sabotage. |
| Who Booked These Guests? | Beverley is an overinvested hired wedding mother; Darren is his wife's fictional online heartthrob; Jaz's divorce party has a communication problem; Colin's ex-partners' support club invites the ex; Iman becomes a family fixture after witnessing strangers' wedding; Tony secretly performs as the rival team's mascot. |
| Bad Joke Hotline | Graham measures dad jokes; Suki satirises her own employer; Mags practises domestic double-entendre; Owen specialises in anti-jokes; Rory attempts radio magic; Val delivers affectionate roasts with an emergency apology poem. |

## Source of truth

- `lib/starter-packs.ts`: IDs, versions, pack names/descriptions, format instructions, independent cast, portraits, image queries/curated images, optional presenter and media/hosting defaults.
- `lib/starter-casts.ts`: the authored human guest cards and safe public personality previews.
- `lib/show-identity.ts`: validated palettes, typography, labels and deterministic SVG channel artwork, shared by the wizard, switcher, Studio and broadcast.
- `lib/channel-creation-options.ts`: public entry labels and default human-hosted choice.
- `lib/channel-creation.ts`: validates and copies a pack, prepares media before the transaction, then atomically creates a Show, caller copies, queue snapshots and optional presenter/module settings.
- `lib/channel-deletion.ts`: exact-name confirmation, conditional non-live deletion and relationship handling.

The UI receives only public menu metadata. It does not import private stories or presenter instructions.

## Channel artwork

Each pack copies an `identity` into `Show.brandingConfig`. Existing and blank channels receive a stable title-based default. **Channel artwork** on a show page offers instant, no-key typographic generation, colour/font/pattern/label/tagline controls and PNG/JPEG/WebP upload. Edits preview locally; **Save artwork** updates the channel and its open broadcast without changing queue, hosting or media controls. Uploaded artwork replaces the poster and thumbnail; the editable label/font also style the broadcast header. Full output shows the poster between calls; the live caller and visuals keep priority. Overlay output uses the compact brand mark only.

Uploads are authenticated, limited to 5 MB / 20 MP, decoded, metadata-stripped and re-encoded as WebP (maximum 1600 pixels per side). They are stored outside the repository at `data/show-artwork/` and served through hashed public image URLs. Only upload material intended for public presentation; artwork URLs do not require the broadcast token. **Back up this directory with the database and mount it as persistent storage in containers.** Replaced/unattached images are retained to avoid breaking other references; there is no automatic asset garbage collection yet. Do not delete files that existing channel identities still reference.

The bundled illustrated guest portraits are generated from [Personas by Draftbit](https://personas.draftbit.com/), via DiceBear, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credits are saved on each portrait asset; these are fictional characters, not stock photos of people accused of the fictional behaviour.

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

`verify:channels` creates its own randomly named local database schema, applies migrations there, checks all three real casts with local-only test visuals, editable artwork/public snapshots, and test-only human/auto fixtures. It verifies copy isolation/media/host defaults and deletion relationships, then removes only that schema. It never uses the user's real channels or makes provider calls. The schema is explicit because the embedded local PostgreSQL runtime does not isolate databases by name in the usual way.
