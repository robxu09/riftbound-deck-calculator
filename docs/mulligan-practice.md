# Mulligan practice

Open a saved deck from Home with **Analyze deck**. The practice panel loads the
latest saved version at that moment and uses only its Main Deck section. The
champion, legend, battlefields, runes and sideboard are excluded. Practice requires
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

Card handling lives in the framework-independent `MulliganPractice` class,
separate from the Angular presentation. This is interactive local practice, not
the planned Python probability or simulation service.
## Draw probabilities

The analysis panel combines optional card-name words, exact card type, and exact
energy cost with AND. For example, Unit + cost 2 + a partial name selects only
cards meeting all three conditions. Costs come from the catalog, including zero
and values above eight. Name filtering does not match card ability text.

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
