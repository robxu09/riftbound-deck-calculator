# Web navigation

- `/` is Home: select a saved deck, then choose Edit deck or Analyze deck.
  Rename, duplicate, export and delete remain available on Home.
- `/builder/new` opens an empty, unsaved draft. Home's import preview opens this
  route with imported cards carried in memory. Save deck creates the record and
  initial version, then replaces the URL with `/builder/{deckId}`.
- `/builder/{deckId}` loads the latest saved version for editing. Save version
  persists the changes. Name changes are handled through Rename on Home.
- `/analysis/{deckId}` requests the existing API summary of the latest saved
  version. It never saves or analyzes the builder's unsaved draft.

The Home link is available on every page. The selected saved deck is remembered
within the current session. Direct builder and analysis links load from the API.
New drafts live in memory until explicitly saved; they do not survive a refresh.
The builder warns before leaving changed/imported drafts, including browser
refresh or tab closure (the browser controls the wording of that warning).
Navigation waits for pending saves; failed saves keep the draft intact.

Angular's page components use a shared DeckWorkspace service for catalog,
import, saved-deck management and editing state. Analysis loads independently.
No API or database changes are required by this navigation milestone.

Analysis currently provides the existing summary, counts, energy curve and any
warnings. Draw probabilities and mulligan practice are the next milestone, with
opening-hand/mulligan rules to be confirmed before implementation.

Production web hosting must rewrite application routes to `index.html` so direct
links and refreshes work; the Angular development server already does this.
