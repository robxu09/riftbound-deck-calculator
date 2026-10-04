# Local deck storage

The running Spring API uses Spring Data JPA and a file-backed H2 database to store
decks and deck versions. Version card lists are stored as JSON, including quantity
and section. Deck names have a database-enforced unique normalized value (trimmed
and lowercase). Deleting a deck also deletes its versions in the same transaction.

With the API started from `apps/api`, the database is
`apps/api/data/riftbound.mv.db`. The configured `./data/riftbound` path is relative
to the process working directory: start the API from the same directory each time
to reopen the same database. An empty list after changing directories can mean
that a different database was opened.

The `data/` directory is ignored by Git. Database contents are **not** included in
a source-code commit or push. To back up local decks, stop the API cleanly and copy
the database file to a separate location. Restore with the API stopped as well.
Do not delete this directory when cleaning build outputs.

The API currently uses Hibernate `ddl-auto=update` for local development. Versioned
schema migrations remain future work. Cards themselves still load from the JSON
catalog, and legality validation is not enforced.

## Tests

`src/test/resources/application.properties` defaults tests to in-memory H2 with
`create-drop`. `DeckServiceTest` additionally pins those settings in its annotation
so its `deleteAll()` cleanup cannot use an environment-provided application database.

`DeckPersistenceRestartTest` creates a separate H2 file under a JUnit temporary
directory. It closes and reopens complete Spring application contexts and checks
deck IDs, version contents and sections, name uniqueness, and persisted deletion.
It never opens the developer's `data/riftbound` database.

Run with JDK 21 from `apps/api`:

```powershell
.\gradlew.bat test
```

Directly constructed `DeckService()` instances still use the lightweight in-memory
fallback for domain tests. The running Spring application injects the JPA repositories.

## Sideboard plans

Plans are stored as JSON in a nullable TEXT column on the deck row. Existing rows
with null have no plans; the local schema update adds this column without replacing
decks or versions. Plan writes lock the deck row to avoid concurrent plan updates
losing one another. Deleting the deck removes its plans; plan saves do not add a
DeckVersion. The restart test covers retained plans and deck deletion.

Routes under /api/decks/{deckId}/sideboard-plans: GET lists, POST creates,
POST /{planId} updates, POST /{planId}/delete removes. Save requests contain name,
baseVersionId, and swaps (outCardId/inCardId pairs, each exchanging one copy).
The API validates version ownership, current version, type and copy availability.
