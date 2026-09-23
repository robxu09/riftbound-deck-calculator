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

data class DeckCard(
    val cardId: String,
    val quantity: Int = 1
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
    val formatId: String
)

data class AddDeckVersionRequest(
    val cards: List<DeckCard>,
    val notes: String? = null
)
