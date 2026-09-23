# Importing a text deck

From **Home**, choose **Import deck**. Paste a list or choose a `.txt` file,
click **Preview import**, then **Use import as new draft** after reviewing the
section totals and notices. This opens **Deck Builder** with the imported cards.
Choose a name and click **Save deck** to persist the draft. Existing decks are
not modified. Invalid imports cannot be applied.

**Create deck** on Home opens an empty, unsaved builder draft. Creation and
import do not write to the API until you click **Save deck**. Names must be
unique, ignoring case and surrounding whitespace. Save errors keep the draft.
For an existing deck, **Save version** persists its edited card list.

Supported headings: `Legend:`, `Champion:`, `MainDeck:` (or `Main Deck:`),
`Battlefields:`, `Runes:`, and `Sideboard:` (or `Side Deck:`). Headings and codes
are case insensitive. Blank lines, UTF-8 BOMs and Windows line endings are accepted.

Each entry has this form:

```text
Champion:
1 Ambessa, The Wolf [VEN-084]

Runes:
6 Body Rune [OGN-126]
6 Order Rune [OGN-214]
```

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

Each saved deck has **Rename**, **Duplicate**, and **Export .txt** actions.

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

API routes: `POST /api/decks/{id}/rename` and `/duplicate` accept `{ "name": "..." }`;
`GET /api/decks/{id}/export` returns `text/plain; charset=UTF-8`. Conflicting names
return 409, missing decks return 404, and invalid names/export data return 400.
