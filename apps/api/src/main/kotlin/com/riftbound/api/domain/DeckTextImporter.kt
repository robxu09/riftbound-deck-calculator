package com.riftbound.api.domain

/** Parses deck lists without applying game legality rules or mutating saved decks. */
class DeckTextImporter(private val catalog: List<Card>) {
    private val headings = mapOf(
        "legend" to DeckSection.LEGEND,
        "champion" to DeckSection.CHAMPION,
        "maindeck" to DeckSection.MAIN_DECK,
        "battlefields" to DeckSection.BATTLEFIELDS,
        "runes" to DeckSection.RUNES,
        "sideboard" to DeckSection.SIDEBOARD,
        "sidedeck" to DeckSection.SIDEBOARD
    )
    private val entry = Regex("""^(\d+)\s+(.+?)\s+\[([^\[\]]+)]$""")

    fun parse(text: String): DeckImportResult {
        val errors = mutableListOf<DeckImportIssue>()
        val warnings = mutableListOf<DeckImportIssue>()
        val cards = linkedMapOf<Pair<DeckSection, String>, DeckCard>()
        if (text.length > 100_000) {
            return DeckImportResult(emptyList(), listOf(DeckImportIssue(0, "Text must be at most 100,000 characters.")), emptyList())
        }
        var section: DeckSection? = null
        var hasHeading = false
        text.removePrefix("\uFEFF").lineSequence().forEachIndexed { index, raw ->
            val line = raw.trim()
            val lineNumber = index + 1
            if (line.isEmpty()) return@forEachIndexed
            if (line.endsWith(":")) {
                section = headings[line.dropLast(1).lowercase().replace(Regex("\\s+"), "")]
                if (section != null) hasHeading = true
                if (section == null) errors.add(DeckImportIssue(lineNumber, "Unknown section: $line"))
                return@forEachIndexed
            }
            val currentSection = section
            if (currentSection == null) {
                errors.add(DeckImportIssue(lineNumber, "Add a recognized section heading before this card."))
                return@forEachIndexed
            }
            val match = entry.matchEntire(line)
            if (match == null) {
                errors.add(DeckImportIssue(lineNumber, "Expected: quantity Card Name [SET-123]."))
                return@forEachIndexed
            }
            val quantity = match.groupValues[1].toIntOrNull()
            if (quantity == null || quantity !in 1..1000) {
                errors.add(DeckImportIssue(lineNumber, "Quantity must be a whole number from 1 to 1,000."))
                return@forEachIndexed
            }
            val name = match.groupValues[2].trim()
            val code = match.groupValues[3].trim().lowercase().replace('/', '-')
            val exact = catalog.filter { it.id.lowercase() == code }
            val candidates = exact.ifEmpty {
                catalog.filter {
                    val id = it.id.lowercase()
                    id.startsWith("$code-") && id.removePrefix("$code-").matches(Regex("\\d+"))
                }
            }
            if (candidates.size != 1) {
                val reason = if (candidates.isEmpty()) "Unknown card code" else "Ambiguous card code; use the full printing ID"
                errors.add(DeckImportIssue(lineNumber, "$reason: ${match.groupValues[3]}."))
                return@forEachIndexed
            }
            val card = candidates.single()
            if (!card.name.equals(name, ignoreCase = true)) {
                warnings.add(DeckImportIssue(lineNumber, "Code ${match.groupValues[3]} matched '${card.name}' (listed as '$name')."))
            }
            val key = currentSection to card.id
            val previous = cards[key]?.quantity ?: 0
            cards[key] = DeckCard(card.id, previous + quantity, currentSection)
        }
        if (!hasHeading && cards.isEmpty() && errors.isEmpty()) errors.add(DeckImportIssue(0, "Paste a deck list containing section headings and cards."))
        return DeckImportResult(cards.values.toList(), errors, warnings)
    }
}
