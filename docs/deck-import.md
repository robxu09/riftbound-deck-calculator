# Importing a deck

From **Home**, choose **Import deck**. Paste a deck code, a list, or choose a `.txt` file,
click **Preview import**, then **Use import as new draft** after reviewing the
section totals and notices. This opens **Deck Builder** with the imported cards.
**Show cards** expands the matched names and printing IDs before accepting the import.
Choose a name and click **Save deck** to persist the draft. Existing decks are
not modified. Invalid imports cannot be applied.

**Create deck** on Home opens an empty, unsaved builder draft. Creation and
import do not write to the API until you click **Save deck**. Names must be
unique, ignoring case and surrounding whitespace. Save errors keep the draft.
For an existing deck, **Save changes** persists its edited card list.

Supported headings: `Legend:`, `Champion:`, `MainDeck:` (or `Main Deck:`),
`Battlefields:`, `Runes:`, and `Sideboard:` (or `Side Deck:`). Headings and codes
are case insensitive. Blank lines, UTF-8 BOMs and Windows line endings are accepted.

Card IDs are optional. Name-only lists and lists with IDs can be mixed:

```text
Champion:
1 Azir, Sovereign

Runes:
6 Body Rune [OGN-126]
6 Order Rune [OGN-214]
```

Names match case-insensitively, with repeated whitespace and curly apostrophes
normalized. No fuzzy name guesses are made. When several printings share a name
and type, a stable standard printing is chosen and disclosed in the preview;
add `[SET-123]` to choose a particular printing. Ambiguous card identities require
an ID. In the Legend section, `Azir, Emperor of the Sands` can match the older
catalog title `Emperor of the Sands`, with a notice. This title fallback applies
only when no full-name match exists.

Codes match exact catalog printing IDs or their short set/number form. Full codes
such as `OGN-126/298` and IDs such as `ogn-126-298` also work. A name difference
produces a notice; the code determines the card. Unknown codes never fall back to
name matching. Repeated lines merge within a section; main-deck and sideboard
entries stay separate. Quantities must be positive integers (up to 1,000 per line,
an input sanity bound, not a game rule). Text is limited to 100,000 characters;
uploaded files are limited to 100 KB.

The supplied Ambessa example is preserved in
`apps/api/src/test/resources/decks/ambessa.txt`. Its actual totals are 1 Legend,
1 Champion, **39** main-deck cards, 3 Battlefields, 12 Runes, and 10 Sideboard
cards: **66 total**. It imports as written, without correcting those quantities.
The catalog calls its Legend `Matriarch of War`, so that line produces a name notice.

The name-only Azir example is preserved in
`apps/api/src/test/resources/decks/azir.txt` and tested with the same six section
totals (66 cards). Its gear cards remain in the Main Deck section as supplied.

## Deck codes

The same field automatically detects Piltover Archive deck codes. It decodes
card IDs, quantities, the chosen champion and sideboard locally in the Kotlin
API, using our catalog. No card images, external API calls, or Riot credentials
are required. See [deck-code format and compatibility](deck-codes.md).

Unknown cards, unsupported data, and malformed codes are shown as preview errors
and block accepting the import. Missing cosmetic variants can use the same
numbered base printing with a notice. Legacy codes without a chosen champion
leave those units in Main Deck and ask you to choose one in the builder.

Saved entries now include a section. Legacy entries without one default to the
main deck. The selected-deck UI displays all six sections; **Add cards to** controls
where manually selected cards go. Target counts are informational. Deck size,
domains, copy limits, Unique tags and section eligibility are not enforced.

Analysis counts all cards, but its energy curve includes only the main deck and
champion. The old placeholder 30–60 total-card warnings were removed to avoid
misreporting sideboard/rune-inclusive lists. Decks and their sections now persist
in the local H2 database across API restarts; see [deck storage](deck-storage.md).

The Kotlin endpoint `POST /api/decks/import-preview` accepts `{ "text": "..." }`
and returns matched `cards`, line-numbered `errors`, and `warnings`. It never saves
or changes a deck. Parsing and matching live in a framework-independent domain class.

## Rename, duplicate and export

Choose a saved deck on Home, then open **More deck actions** for **Rename**,
**Duplicate**, **Export .txt**, and **Copy deck code**. **Delete deck** asks for confirmation by name
and deletes the deck together with its saved versions.

- Rename changes the name in place, keeping its ID and all version history.
  Names must be nonblank, at most 255 characters and unique ignoring case and
  surrounding whitespace. Renaming does not save or discard unsaved card edits.
- Duplicate asks for a new name and copies the latest saved version into a new
  deck with its own ID and initial version. Earlier history is not copied. The
  current selection stays in place; select the saved copy to open it.
- Export downloads the latest saved version as UTF-8 text with all six sections,
  quantities, and full printing IDs. It does not include unsaved edits, deck name,
  version history or notes. Reimport the file and choose a name to save a new deck.
  An empty deck exports section headings and imports as an empty draft.
  Missing catalog IDs produce an error rather than silently dropping cards.
- Copy deck code encodes the latest saved version, including sideboard and chosen
  champion. It copies to the clipboard and provides a selectable text field if
  clipboard access is unavailable. It excludes sideboard plans, notes and history.
  Drafts whose section assignments cannot be preserved in a code can still use
  text export; the error explains this rather than rearranging the draft.

API routes: `POST /api/decks/{id}/rename` and `/duplicate` accept `{ "name": "..." }`;
`GET /api/decks/{id}/export` returns `text/plain; charset=UTF-8`. Conflicting names
return 409, missing decks return 404, and invalid names/export data return 400.
`GET /api/decks/{id}/export-code` returns the code as `text/plain; charset=UTF-8`.
Import previews also include a `cardNames` map for displaying matched entries.
