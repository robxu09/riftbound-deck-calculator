# Mulligan practice

Open a saved deck from Home with **Analyze deck**. The practice panel loads the
latest saved version at that moment. Hand draws use only its Main Deck section;
the rune practice pile uses the separate Runes section. Champion, legend,
battlefields and sideboard are excluded from hand draws. Practice requires
39 Main Deck cards and available catalog details; this does not change the
builder's permissive save behavior or establish deck legality.

Each run shuffles those 39 individual card copies and deals four. Select zero,
one or two opening cards, then choose **Keep all four** or **Replace N selected**.
Selected cards go to the bottom, followed immediately by the same number of
replacement draws, returning the hand to four. Cards at the bottom stay there;
there is no additional shuffle. Selection order sets bottom order: position 1 is
drawn before position 2 if the pile is exhausted later.

**Draw one** adds the next card to your hand and records the draw. The panel shows
cards remaining, the last draw, and an expandable history of subsequent draws.
Drawing stops when the pile is empty. **Reset practice** reshuffles the full
39-card saved list and deals a fresh four, clearing the selection and draw history.
Reset uses the already loaded saved version; reloading analysis fetches the latest.

Practice is local to the browser session. It does not change or save deck cards,
record match results, or advance a turn automatically. Leaving the page discards
the practice run. The rules above follow the user-confirmed practice behavior;
this feature does not claim complete official rules or legality validation.

A compact **Points** counter appears above the hand.
Use **+** and **−** to adjust it one point at a time. It starts at zero and cannot
go below zero; there is no automatic scoring or winning-score limit. Drawing,
playing cards, and channeling/recycling runes keep the counter unchanged.
**Reset practice**, applying/restoring a sideboard lineup, or loading another
deck starts the counter at zero again. Points are not saved to the deck.

The **Turn** counter sits before Points in the controls, with **+** and
**−** controls. It starts at 1 and cannot go below 1. Turn changes are manual;
they do not draw cards, channel runes, award points, or automate turn phases.
Resetting practice, applying/restoring a lineup, or loading another deck also
resets the turn to 1. Both counters fit side by side on mobile.

Card handling lives in the framework-independent `MulliganPractice` class,
separate from the Angular presentation. This is interactive local practice, not
the planned Python probability or simulation service.
## Draw probabilities

The analysis panel combines optional card-name words, printed keywords, exact card type, and exact
energy cost with AND. For example, Hidden + Unit + cost 2 + a partial name selects only
cards meeting all selected conditions. Costs come from the catalog, including zero
and values above eight. Name filtering does not match card ability text.

**Printed keyword** matches a keyword declaration on the card, ignoring case.
For example, Hidden matches Blastcone Fae and Windsinger, but not Ava Achiever,
which only mentions other cards with Hidden. Both panels use a dropdown populated
from the loaded catalog. Select one keyword, or **Any keyword** to clear that
filter. `Shield` includes its numbered forms. Energy cost is also a dropdown in
both panels, with **Any cost** and the catalog's numeric costs, including zero.

Keyword extraction is shared by both odds panels in `card-keywords.ts`. It reads
standalone declarations at the start of a printed-text line, including adjacent
declarations and unbracketed gallery spellings. References in effects or reminder
text do not count. Conditional/granted keywords are not included; this filter
describes printed declarations rather than simulating board conditions. The
catalog has no structured keyword field, so extraction follows the current text
format and is covered by tests, rather than claiming a complete rules parser.

The displayed percentage is the chance of at least one matching copy in the next
N draws, not the probability that the whole hand contains a match. Matching counts
show hand and remaining pile separately. No matches returns 0%, not missing data.
A draw count must be a positive integer; horizons exceeding the remaining pile are
capped at that pile's size. An exhausted pile returns 0 draws and 0%.

For the unknown region of the pile, with U cards, K matches and n draws, the
calculation is 1 - C(U-K,n)/C(U,n). It uses an equivalent product of miss
probabilities to avoid large intermediate combinations. It counts individual
copies and does not inspect their hidden order. Known bottomed cards are excluded
from that random region. Once the requested horizon reaches the bottom, their
known order determines which are included; reaching a known match guarantees 100%.
Replacements, subsequent draws and reset update both regions appropriately.
Before confirming a mulligan, the odds describe the current pile; pending selected
cards are still in hand. Confirmation updates the odds after replacement draws.

Tests compare known fractions and an exhaustive enumeration of small-pile draw
outcomes, as well as known-bottom boundaries, reset, exhaustion, UI filter
combinations, and independence from the unknown shuffled order.

## Opening hand odds

A collapsible panel calculates exact odds of at least 1, 2, 3, or 4 matching
copies in a fresh opening four from the saved 39-card Main Deck, before mulligan.
Name words, printed keywords, card type, and Energy cost filters combine with AND. Energy supports
exactly, at most, and at least; **Any cost** clears the cost filter. Unknown costs do not
match numeric comparisons. Other deck sections are excluded.

The result sums hypergeometric outcomes for the requested minimum through four.
It does not depend on the current practice hand, replacements, draws, or reset.
Tests compare every possible opening four against the calculated probabilities.

## Sideboard swaps and plans

Analysis has a collapsed Sideboard plans & swaps panel at the bottom of the page. Stage one-copy
exchanges from the saved Main Deck to the saved Sideboard, with units and spells
as the available choices. Each original copy can be used once; exchanged copies
cannot be chained into later swaps. Undo removes a staged pair. Pending swaps do
not change practice or odds until Apply & restart practice is selected.

Applying replaces the practice session with a freshly shuffled 39-card adjusted
Main Deck. Opening-hand odds and next-draw odds use that same adjusted lineup.
Reset practice keeps the adjusted lineup; Restore saved lineup clears every swap
and restarts from the saved default. Leaving analysis discards temporary swaps.
Legend, champion, battlefields, runes, saved deck versions and total copy counts
are unchanged. These are lineup checks, not full tournament-legality validation.

Named plans belong to a deck, persist through the API, and are available through
a dropdown inside the panel. Save/update/delete controls are in a nested collapsed
section. Load swaps previews the pairs; applying remains explicit. Plan names are
trimmed, case-insensitively unique within a deck, and limited to 80 characters.
Plans record the exact saved version they were created for; saving a new version
marks old plans as older and prevents loading them. Recreate them for the new list.
Deleting a plan keeps the current temporary lineup. Duplicating a deck does not
copy its plans. Phones stack the two card selectors and the apply/reset controls.

## Manual play practice

After confirming the mulligan, each hand card has Remove from hand. This moves
one copy into a collapsed Played / discarded list; Undo returns that copy to hand.
These are manual removals, with no automatic cost payment or card effects. They
never put cards back in the main draw pile, change its order, or trigger new draws.
Next-draw odds remain based on the remaining pile, including known bottom cards;
matching counts distinguish hand, removed cards, and remaining deck. Opening-hand
odds still describe a fresh opening four from the current analysis lineup.

The Runes section builds a separate shuffled rune pile with individual copies.
Channel 1 moves its top rune into play. Recycle 1 returns a chosen rune in play to
the bottom; sequential recycling preserves the user's action order. Matching rune
printings share one row in the UI, with a count. Controls are manual after mulligan,
without automated phases or resource accounting. Movement definitions were checked
against the published [core rules](https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/861747d1d4d505b7c14d73aba9749d1c3a209a67.pdf)
on 2026-10-03; the current rules index is [Riot's rules hub](https://playriftbound.com/en-us/rules-hub/).

Reset practice restores all hand/removed cards, clears histories, reshuffles the
current Main Deck and rune pile, and deals a new opening four. An applied sideboard
lineup stays applied. Applying or restoring a sideboard lineup also starts both
piles over. Leaving analysis discards the entire session. No saved deck or plan
is changed by these controls. Rune practice uses however many saved runes exist;
missing/invalid rune data disables only rune practice, not the main hand controls.

Analysis places controls first: Turn, Points, Channel 1, Draw one, and Reset practice.
Channel and draw are disabled until the mulligan is confirmed. Controls wrap in
that order on mobile. The hand follows, then collapsible Played / discarded, Runes,
Draw history, Opening hand odds, Next draw odds, and Sideboard plans & swaps last.
Draw history uses the same collapsed panel styling as the odds and sideboard
panels, and appears once a card has been drawn. Toggling panels keeps their state.
The Runes dropdown contains in-play runes and recycle controls after confirming the mulligan. The same order is used on
mobile and desktop.
