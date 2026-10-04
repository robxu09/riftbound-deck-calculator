# Deck-code compatibility

The shared Kotlin API supports the public
[Piltover Archive RiftboundDeckCodes format](https://github.com/Piltover-Archive/RiftboundDeckCodes).
Encoding/decoding is in `DeckCodeCodec`, independent of Spring and the catalog.
`DeckCodeImporter` and `DeckCodeExporter` adapt it to our six deck sections.
Keeping this in the API gives web, iOS, and Android the same import behavior.

## Reference and tests

The wire format is base32 over binary data: format/version, grouped card
quantities and printing references, then optional champion/additional legends.
The implementation was checked against the published
`@piltoverarchive/riftbound-deck-codes@1.5.0` reference library (Apache 2.0,
Copyright 2025 PiltoverArchive). Attribution is retained in
`third-party/PiltoverArchive-LICENSE.txt`. The Kotlin implementation adds bounds,
strict truncation/trailing-data checks and catalog/section validation.

`apps/api/src/test/resources/decks/deck-codes.json` contains reference-library
fixtures and expected decoded data. Tests decode versions 1–6 and compare emitted
codes byte-for-byte for versions 3–6. The v2 fixture is the published Kai'Sa
example. The v1 fixture uses the documented v1 body (the reference v3 Azir code
without sideboard/champion trailers); its expected data was also decoded by the
reference library. Tests include the supplied Azir text list, champion count
conservation, sideboard preservation, rune/special prefixes, artwork variants,
large counts, and malformed input.

Normal decks emit v3; R-prefixed rune numbers need v4; SP-prefixed cards or counts
above 12 main / 3 sideboard need v5. These thresholds select an encoding version,
not deck legality. Supported set IDs are OGN, OGS, ARC, SFD, UNL, VEN and RAD.
Future sets or versions fail explicitly until the mappings are updated.

## Section mapping and limits

- The wire-format main array includes legend, runes, battlefields and the chosen
  champion. Card type determines their builder sections. The chosen champion
  reference marks one copy already in that array: import subtracts it from Main
  Deck and places it in Champion. Export adds it back before encoding.
- Sideboard entries remain separate, including cards also present in Main Deck.
- Versions 1–2 cannot identify the chosen champion. A notice asks the user to
  move a unit into Champion; the importer does not guess.
- The codec understands v6 additional legends, but the current deck model has
  no separate additional-legend selection. Such imports are blocked explicitly,
  so those cards cannot be lost or confused with the starting legend.
- Unknown numbered cards are errors. A missing cosmetic suffix may use its exact
  numbered base card, with a notice; an available variant remains unchanged.
- Codes do not preserve arbitrary section assignments. Export rejects drafts
  that cannot round-trip, such as a rune manually placed in Main Deck or multiple
  chosen champions, and recommends text export. This does not add game-rule
  enforcement to the builder.
- Names, version notes/history and saved sideboard plans are not part of the code.
- Input is limited to 100,000 characters and merged quantities to 1,000,000 per
  card/section. Unknown flags, sets, variants, truncated data and oversized counts
  produce errors rather than partial successful imports.

RiftAtlas's accepted format versions have not been independently verified.
Compatibility is established against Piltover Archive's reference library;
other tools must support the particular emitted version and card sets.
