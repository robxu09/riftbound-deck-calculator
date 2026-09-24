# Web navigation

- `/` is Home: choose a saved deck from the Selected deck dropdown, then choose Analyze
  deck or Edit deck. Create deck and Import deck have a separate section. Rename,
  duplicate, export and delete are grouped under More deck actions. Deletion
  confirms the deck name and removal of all saved versions; the next available
  deck is selected only after a successful deletion.
- `/builder/new` opens an empty, unsaved draft. Home's import preview opens this
  route with imported cards carried in memory. Save deck creates the record and
  initial version, then replaces the URL with `/builder/{deckId}`.
- `/builder/{deckId}` loads the latest saved version for editing. Save changes
  persists the changes. Name changes are handled through Rename on Home.
- `/analysis/{deckId}` opens mulligan practice using the latest saved version.
  It never saves or uses the builder's unsaved draft.

The Home link is available on every page. The selected saved deck is remembered
within the current session. Direct builder and analysis links load from the API.
New drafts live in memory until explicitly saved; they do not survive a refresh.
The builder warns before leaving changed/imported drafts, including browser
refresh or tab closure (the browser controls the wording of that warning).
Navigation waits for pending saves; failed saves keep the draft intact.

On screens up to 760px wide, the builder uses Deck and Add cards views. Switching
views preserves the draft, filters and destination section. A sticky toolbar keeps
the deck name and Save deck / Save changes action available in both views. Desktop
screens retain the side-by-side catalog and deck layout.

Angular's page components use a shared DeckWorkspace service for catalog,
import, saved-deck management and editing state. Analysis loads independently.
No API or database changes are required by this navigation milestone.

Analysis focuses on [mulligan practice](mulligan-practice.md). The saved-deck
summary is no longer displayed or requested by this page. Combined-filter draw probabilities are available alongside practice; deeper
analysis remains future work.

Production web hosting must rewrite application routes to `index.html` so direct
links and refreshes work; the Angular development server already does this.

Home is the navigation hub: Builder and Analysis each return Home instead of
linking directly to each other. The builder shows its name and save status once,
in the sticky toolbar. Existing decks omit the disabled name field, and the format
control is hidden while only one format is available.
