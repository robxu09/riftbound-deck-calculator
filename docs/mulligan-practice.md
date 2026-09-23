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
