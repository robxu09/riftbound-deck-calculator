package com.riftbound.api.service

import com.riftbound.api.domain.AddDeckVersionRequest
import com.riftbound.api.domain.Card
import com.riftbound.api.domain.CreateDeckRequest
import com.riftbound.api.domain.Deck
import com.riftbound.api.domain.DeckAnalysisRequest
import com.riftbound.api.domain.DeckAnalysisResult
import com.riftbound.api.domain.DeckCard
import com.riftbound.api.domain.DeckVersion
import com.riftbound.api.domain.Format
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class DeckService {

    private val cards = CardCatalog.load()

    private val formats = mutableListOf(
        Format("format-constructed", "Constructed", 60, 30, 3, "1.0")
    )

    private val decks = mutableMapOf<String, Deck>()
    private val deckVersions = mutableMapOf<String, MutableList<DeckVersion>>()

    fun getCards(): List<Card> = cards.toList()

    fun getCard(id: String): Card? = cards.firstOrNull { it.id == id }

    fun getFormats(): List<Format> = formats.toList()

    fun getDecks(): List<Deck> = decks.values.toList().sortedByDescending { it.createdAt }

    fun getDeck(deckId: String): Deck? = decks[deckId]

    fun deleteDeck(deckId: String): Boolean {
        val removed = decks.remove(deckId) != null
        if (removed) {
            deckVersions.remove(deckId)
        }
        return removed
    }

    fun createDeck(request: CreateDeckRequest): Deck {
        val deck = Deck(
            id = UUID.randomUUID().toString(),
            name = request.name,
            formatId = request.formatId,
            createdAt = Instant.now()
        )
        decks[deck.id] = deck
        deckVersions[deck.id] = mutableListOf()
        return deck
    }

    fun addDeckVersion(deckId: String, request: AddDeckVersionRequest): DeckVersion {
        val deck = decks[deckId] ?: throw IllegalArgumentException("Deck not found: $deckId")
        val version = DeckVersion(
            id = UUID.randomUUID().toString(),
            deckId = deck.id,
            cards = request.cards,
            notes = request.notes,
            createdAt = Instant.now()
        )
        deckVersions.getOrPut(deck.id) { mutableListOf() }.add(version)
        return version
    }

    fun getDeckVersions(deckId: String): List<DeckVersion> = deckVersions[deckId]?.toList() ?: emptyList()

    fun analyzeDeck(request: DeckAnalysisRequest): DeckAnalysisResult {
        val deck = decks[request.deckId] ?: throw IllegalArgumentException("Deck not found: ${request.deckId}")
        val format = formats.firstOrNull { it.id == request.formatId }
            ?: throw IllegalArgumentException("Format not found: ${request.formatId}")

        val latestVersion = deckVersions[deck.id]?.lastOrNull()
            ?: throw IllegalArgumentException("Deck has no versions: ${deck.id}")

        val cardCount = latestVersion.cards.sumOf { it.quantity }
        val uniqueCardCount = latestVersion.cards.size
        val manaCurve = latestVersion.cards
            .mapNotNull { card -> getCard(card.cardId)?.cost?.let { Pair(it, card.quantity) } }
            .groupBy({ it.first.toString() }, { it.second })
            .mapValues { (_, values) -> values.sum() }

        val warnings = mutableListOf<String>()
        if (cardCount < format.minDeckSize) {
            warnings.add("Deck is below the minimum size for ${format.name}.")
        }
        if (cardCount > format.maxDeckSize) {
            warnings.add("Deck is above the maximum size for ${format.name}.")
        }

        val summary = buildString {
            append("${deck.name} is analyzed in ${format.name}. ")
            append("It contains $cardCount cards across $uniqueCardCount unique entries.")
        }

        return DeckAnalysisResult(
            deckId = deck.id,
            formatId = format.id,
            cardCount = cardCount,
            uniqueCardCount = uniqueCardCount,
            manaCurve = manaCurve,
            summary = summary,
            warnings = warnings
        )
    }
}
