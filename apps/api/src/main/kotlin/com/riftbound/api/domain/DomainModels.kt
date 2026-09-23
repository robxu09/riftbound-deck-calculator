package com.riftbound.api.domain

import java.time.Instant

data class Card(
    val id: String,
    val name: String,
    val type: String,
    val cost: Int?,
    val text: String,
    val setCode: String,
    val version: Int = 1,
    val createdAt: Instant = Instant.now(),
    val power: Int? = null,
    val might: Int? = null,
    val domains: List<String> = emptyList(),
    val supertype: String? = null,
    val rarity: String? = null,
    val source: String? = null,
    val sourceId: String? = null,
    val sourceUpdatedAt: String? = null,
    val contentHash: String? = null
)

enum class DeckSection { LEGEND, CHAMPION, MAIN_DECK, BATTLEFIELDS, RUNES, SIDEBOARD }

data class DeckCard(
    val cardId: String,
    val quantity: Int = 1,
    val section: DeckSection = DeckSection.MAIN_DECK
)

data class DeckImportRequest(val text: String)
data class DeckImportIssue(val line: Int, val message: String)
data class DeckImportResult(
    val cards: List<DeckCard>,
    val errors: List<DeckImportIssue>,
    val warnings: List<DeckImportIssue>
)

data class Deck(
    val id: String,
    val name: String,
    val formatId: String,
    val createdAt: Instant = Instant.now()
)

data class DeckVersion(
    val id: String,
    val deckId: String,
    val cards: List<DeckCard>,
    val notes: String? = null,
    val createdAt: Instant = Instant.now()
)

data class Format(
    val id: String,
    val name: String,
    val maxDeckSize: Int = 60,
    val minDeckSize: Int = 30,
    val cardLimit: Int = 3,
    val rulesVersion: String = "1.0"
)

data class DeckAnalysisRequest(
    val deckId: String,
    val formatId: String,
    val analysisType: String = "summary"
)

data class DeckAnalysisResult(
    val deckId: String,
    val formatId: String,
    val cardCount: Int,
    val uniqueCardCount: Int,
    val manaCurve: Map<String, Int>,
    val summary: String,
    val warnings: List<String> = emptyList()
)

data class CreateDeckRequest(
    val name: String,
    val formatId: String,
    val cards: List<DeckCard> = emptyList()
)

class DuplicateDeckNameException(name: String) : IllegalArgumentException("A saved deck named '$name' already exists. Choose a different name.")

data class AddDeckVersionRequest(
    val cards: List<DeckCard>,
    val notes: String? = null
)
