package com.riftbound.api.domain

/** Converts wire-format cards into our six sections without changing quantities. */
class DeckCodeImporter(catalog: List<Card>) {
    private val matcher = ImportCardMatcher(catalog)

    fun parse(text: String): DeckImportResult {
        val errors = mutableListOf<DeckImportIssue>()
        val warnings = mutableListOf<DeckImportIssue>()
        val entries = linkedMapOf<Pair<DeckSection, String>, DeckCard>()
        val decoded = try { DeckCodeCodec.decode(text) } catch (error: IllegalArgumentException) {
            return DeckImportResult(emptyList(), listOf(DeckImportIssue(0, error.message ?: "Invalid deck code.")), emptyList())
        }
        if (decoded.additionalLegends.isNotEmpty()) {
            errors.add(DeckImportIssue(0, "This code includes additional legends, which this deck builder does not yet support."))
        }
        fun resolve(code: String): Card? = try {
            matcher.byCode(code)
        } catch (error: IllegalArgumentException) {
            // Catalog imports exclude some cosmetic variants. Only fall back
            // to that exact numbered card, and disclose the printing change.
            val base = code.replace(Regex("[asb*]$"), "")
            val card = if (base != code && error.message?.startsWith("Unknown card code") == true)
                runCatching { matcher.byCode(base) }.getOrNull() else null
            if (card != null) warnings.add(DeckImportIssue(0, "$code artwork is unavailable; using ${card.name} [${card.id.uppercase()}]."))
            else errors.add(DeckImportIssue(0, error.message ?: "Unknown card: $code."))
            card
        }
        fun add(card: Card, count: Int, section: DeckSection) {
            val key = section to card.id
            val total = (entries[key]?.quantity ?: 0).toLong() + count
            if (total > 1_000_000) errors.add(DeckImportIssue(0, "Quantity is too large for ${card.name}."))
            else entries[key] = DeckCard(card.id, total.toInt(), section)
        }
        decoded.mainDeck.forEach { entry -> resolve(entry.cardCode)?.let { add(it, entry.count, sectionFor(it)) } }
        decoded.sideboard.forEach { entry -> resolve(entry.cardCode)?.let { add(it, entry.count, DeckSection.SIDEBOARD) } }
        if (decoded.chosenChampion != null) {
            resolve(decoded.chosenChampion)?.let { champion ->
                val key = DeckSection.MAIN_DECK to champion.id
                val original = entries[key]
                if (champion.type != "Unit" || original == null || original.quantity < 1) {
                    errors.add(DeckImportIssue(0, "Chosen champion must be a unit included in the code's main deck."))
                } else {
                    // The chosen copy is already counted in the encoded main deck.
                    if (original.quantity == 1) entries.remove(key)
                    else entries[key] = original.copy(quantity = original.quantity - 1)
                    add(champion, 1, DeckSection.CHAMPION)
                }
            }
        } else if (decoded.mainDeck.isNotEmpty()) {
            warnings.add(DeckImportIssue(0, "This code does not specify a chosen champion. Move one unit from Main Deck to Champion in the builder."))
        }
        return DeckImportResult(entries.values.sortedBy { it.section.ordinal }, errors.distinct(), warnings.distinct())
    }

    companion object {
        fun sectionFor(card: Card): DeckSection = when (card.type) {
            "Legend" -> DeckSection.LEGEND
            "Battlefield" -> DeckSection.BATTLEFIELDS
            "Rune" -> DeckSection.RUNES
            else -> DeckSection.MAIN_DECK
        }
    }
}
