package com.riftbound.api.domain

/** Lossless section/printing export in the same format accepted by DeckTextImporter. */
class DeckTextExporter(catalog: List<Card>) {
    private val cardsById = catalog.associateBy { it.id }
    private val headings = linkedMapOf(
        DeckSection.LEGEND to "Legend", DeckSection.CHAMPION to "Champion",
        DeckSection.MAIN_DECK to "MainDeck", DeckSection.BATTLEFIELDS to "Battlefields",
        DeckSection.RUNES to "Runes", DeckSection.SIDEBOARD to "Sideboard"
    )

    fun export(entries: List<DeckCard>): String {
        val text = headings.entries.joinToString("\n\n") { (section, heading) ->
            buildString {
                append("$heading:")
                entries.filter { it.section == section }.forEach { entry ->
                    val card = cardsById[entry.cardId]
                        ?: throw IllegalArgumentException("Cannot export unknown card ID: ${entry.cardId}. Refresh the card catalog first.")
                    require(entry.quantity > 0) { "Cannot export a non-positive quantity for ${card.name}." }
                    require(entry.quantity <= 1_000_000) { "Quantity is too large to export for ${card.name}." }
                    // The importer accepts at most 1,000 per line and combines repeated rows.
                    var remaining = entry.quantity
                    while (remaining > 0) {
                        val quantity = minOf(remaining, 1000)
                        append("\n$quantity ${card.name} [${card.id.uppercase()}]")
                        remaining -= quantity
                    }
                }
            }
        } + "\n"
        require(text.length <= 100_000) { "This deck exceeds the text import/export size limit." }
        return text
    }
}
