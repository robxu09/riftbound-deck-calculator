# Local card catalog

The Kotlin API loads `apps/api/src/main/resources/catalog/cards.json` at startup.
Angular continues to use `/api/cards`; neither client nor server downloads cards
during normal browsing. No images, image URLs, credentials, or new dependencies
are needed. The only offered format is Constructed.

## Refresh from the repository root

```powershell
python ingestion/import_cards.py
```

Restart the API after refreshing (rebuild the JAR if running a packaged build).
The default source is [slimtreble/Riftbound-card-data](https://github.com/slimtreble/Riftbound-card-data),
a community JSON export of Riot's gallery. The initial import has 1,042 records
after excluding 138 flagged alternate/signed/variant records from 1,180 source records.
The source's two untyped records (Buff and XP Tracker) are explicitly `Unknown`.
No card type or missing numeric value is inferred.

Riftcodex returned a Cloudflare browser challenge from the development environment,
so the initial snapshot uses the downloadable dataset. An optional Riftcodex
adapter follows its [documented card schema](https://riftcodex.com/docs/endpoints/cards/):

```powershell
python ingestion/import_cards.py --source riftcodex
```

That adapter's mapping and pagination are fixture-tested; a complete live import
has not been verified. It expects an `items`/`total` pagination envelope and fails
without replacing the snapshot on an unexpected response. Sources are never
silently switched. A saved source JSON array can also be imported offline:

```powershell
python ingestion/import_cards.py --input path/to/cards.json
```

Downloads finish and validate before atomically replacing the snapshot. Failed
downloads, invalid attributes, empty catalogs, and duplicate IDs leave it intact.
Review catalog diffs before accepting refreshes, especially removed cards.

## Data and current limits

- Card IDs use the source's Riftbound printing ID, not names or collector numbers
  alone. Flagged variants are omitted; this is not a universal reprint identity model.
- `cost` is energy (nullable), with separate power and might. Missing costs stay
  null and do not enter the energy curve; a real zero cost remains zero.
  The response field `manaCurve` is retained for compatibility.
- The snapshot records its source URL, fetch time, schema version and text status.
  Cards retain source IDs, source update times when available, a content hash and
  a revision number. Identical reimports keep revisions; changes increment them.
  The gallery export does not supply per-card update times.
- Gallery text is printed text, not verified errata. Preview cards and tokens may
  be present. Catalog membership does not establish Constructed legality.
- Deck-size bounds are still the existing MVP placeholders (30–60), not a complete
  Constructed rules implementation. The UI labels analysis as a basic summary.
- Decks remain in memory and refer to the current catalog. Historical card-revision
  pinning in saved deck versions and durable deck storage remain future work.
  Keep snapshot history in version control; the importer replaces the current file.
- Card data belongs to Riot; the community scripts' license does not transfer
  ownership of card text. Source attribution is retained here and in the snapshot.

## Verification

```powershell
python -m unittest discover -s ingestion -p "test_*.py"
# In apps/api, with JDK 21 configured:
.\gradlew.bat test
# In apps/web:
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```
