package com.riftbound.api.domain

import java.text.Normalizer

/** Resolves printing IDs or exact names; never substitutes a guessed/fuzzy name. */
class ImportCardMatcher(private val catalog: List<Card>) {
    data class Match(val card: Card, val notice: String? = null)

    fun byCode(raw: String): Card {
        val code = raw.trim().lowercase().replace('/', '-')
        val exact = catalog.filter { it.id.lowercase() == code }
        val candidates = exact.ifEmpty {
            catalog.filter {
                val id = it.id.lowercase()
                id.startsWith("$code-") && id.removePrefix("$code-").matches(Regex("\\d+"))
            }
        }
        require(candidates.isNotEmpty()) { "Unknown card code: $raw." }
        require(candidates.size == 1) { "Ambiguous card code; use the full printing ID: $raw." }
        return candidates.single()
    }

    fun byName(name: String, section: DeckSection): Match {
        val normalized = normalize(name)
        var candidates = catalog.filter { normalize(it.name) == normalized }
        var titleOnly = false
        // Older catalog records omit the character before a legend's comma.
        // This limited fallback is explicit in the preview; no fuzzy search.
        if (candidates.isEmpty() && section == DeckSection.LEGEND && ',' in normalized) {
            val title = normalized.substringAfter(',').trim()
            candidates = catalog.filter { it.type == "Legend" && normalize(it.name) == title }
            titleOnly = candidates.isNotEmpty()
        }
        require(candidates.isNotEmpty()) { "Unknown card name: $name. Add [SET-123] if available." }
        require(candidates.map { normalize(it.name) to it.type }.distinct().size == 1) {
            "Ambiguous card name: $name. Add [SET-123] to choose the card."
        }
        // A name-only list has no printing preference. Pick a stable standard
        // printing, with an explicit notice when several printings exist.
        val setOrder = listOf("OGN", "OGS", "ARC", "SFD", "UNL", "VEN", "RAD")
        val card = candidates.minWith(compareBy<Card> { it.rarity.equals("Showcase", ignoreCase = true) }
            .thenBy { setOrder.indexOf(it.setCode).let { index -> if (index < 0) Int.MAX_VALUE else index } }
            .thenBy { it.id })
        val notice = when {
            titleOnly -> "'$name' matched '${card.name}' [${card.id.uppercase()}] by legend title."
            candidates.size > 1 -> "Multiple printings of '${card.name}'; using [${card.id.uppercase()}]. Add a card code to choose another."
            else -> null
        }
        return Match(card, notice)
    }

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
        .replace('\u2019', '\'').replace('\u2018', '\'').trim().replace(Regex("\\s+"), " ").lowercase()
}
