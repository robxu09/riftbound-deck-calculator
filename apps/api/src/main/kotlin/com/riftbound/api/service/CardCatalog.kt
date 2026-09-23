package com.riftbound.api.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.riftbound.api.domain.Card
import java.time.Instant

data class CardSnapshot(
    val schemaVersion: Int,
    val source: String,
    val sourceUrl: String,
    val fetchedAt: Instant,
    val textStatus: String,
    val sourceRecordCount: Int,
    val excludedVariants: Int,
    val cards: List<Card>
)

object CardCatalog {
    fun load(): List<Card> {
        val mapper = jacksonObjectMapper().findAndRegisterModules()
        val stream = checkNotNull(javaClass.getResourceAsStream("/catalog/cards.json")) {
            "Card snapshot missing. Run python ingestion/import_cards.py before starting the API."
        }
        val snapshot = stream.use { mapper.readValue<CardSnapshot>(it) }
        check(snapshot.schemaVersion == 1) { "Unsupported card snapshot version" }
        check(snapshot.cards.isNotEmpty()) { "Card snapshot is empty" }
        check(snapshot.cards.map { it.id }.distinct().size == snapshot.cards.size) { "Duplicate card IDs" }
        return snapshot.cards
    }
}
