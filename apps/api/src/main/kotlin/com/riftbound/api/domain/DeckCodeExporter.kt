package com.riftbound.api.domain

class DeckCodeExporter(catalog: List<Card>) {
    private val cardsById = catalog.associateBy { it.id }
    private val matcher = ImportCardMatcher(catalog)

    fun export(entries: List<DeckCard>): String {
        val main = mutableListOf<DeckCodeCodec.Entry>()
        val side = mutableListOf<DeckCodeCodec.Entry>()
        var champion: String? = null
        entries.forEach { entry ->
            val card = cardsById[entry.cardId]
                ?: throw IllegalArgumentException("Cannot export unknown card ID: ${entry.cardId}.")
            // Remove our catalog's printed set-size suffix, retaining R/SP/art suffixes.
            val printing = Regex("([a-z]{3}-(?:sp|r)?\\d+[asb*]?)(?:-\\d+)?").matchEntire(card.id)
            requireNotNull(printing) { "Unsupported card ID: ${card.id}. Use Export .txt for this draft." }
            val code = printing.groupValues[1].uppercase()
                .replace(Regex("([ASB])$")) { it.value.lowercase() }
            require(matcher.byCode(code).id == card.id) { "Cannot represent printing ${card.id} in a deck code. Use Export .txt." }
            when (entry.section) {
                DeckSection.CHAMPION -> {
                    require(champion == null && entry.quantity == 1 && card.type == "Unit") {
                        "Deck codes support one chosen champion unit. Use Export .txt for this draft."
                    }
                    champion = code
                }
                DeckSection.SIDEBOARD -> Unit
                else -> require(entry.section == DeckCodeImporter.sectionFor(card)) {
                    "${card.name} is in a section that deck codes cannot preserve. Use Export .txt for this draft."
                }
            }
            val target = if (entry.section == DeckSection.SIDEBOARD) side else main
            target.add(DeckCodeCodec.Entry(code, entry.quantity))
        }
        return DeckCodeCodec.encode(DeckCodeCodec.DeckCode(main, side, champion))
    }
}
