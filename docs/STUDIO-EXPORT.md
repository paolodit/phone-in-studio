# Portable studio export

Use **Export studio** in the navigation while signed in. The JSON contains shows, callers, caller assets, running orders, creative plans, transcripts/events, host profiles and uploaded show artwork.

It excludes login/password data, API keys, hosted credit/payment records, optional-module settings and browser recordings. External image, sound and music URLs stay as URLs: third-party media is not downloaded. Download recordings from the browser separately. Treat the export as private: it includes your character prompts and transcripts.

To leave hosted service, install the same app release with an empty, migrated PostgreSQL database and your own API credentials. Set DATABASE_URL, then run:

```sh
npx tsx scripts/import-studio.ts /path/to/studio-export.json
```

The importer refuses a nonempty creative database and hosted runtime. It does not merge or overwrite existing shows. It rotates broadcast links and resets live playback state so imported channels are private and idle. Optional modules must be configured again. Back up the destination before importing.

Portable exports support up to 50 MB of uploaded artwork. Larger studios need an operator backup (database plus artwork volume). Export does not delete or close the account.
