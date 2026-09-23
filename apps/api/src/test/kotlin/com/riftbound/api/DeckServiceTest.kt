package com.riftbound.api

import com.riftbound.api.domain.AddDeckVersionRequest
import com.riftbound.api.domain.CreateDeckRequest
import com.riftbound.api.domain.DeckCard
import com.riftbound.api.domain.DeckAnalysisRequest
import com.riftbound.api.service.DeckService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DeckServiceTest {

    private val deckService = DeckService()

    @Test
    fun `creates deck and returns it`() {
        val created = deckService.createDeck(CreateDeckRequest("Test Deck", "format-constructed"))

        assertNotNull(created.id)
        assertEquals("Test Deck", created.name)
        assertEquals("format-constructed", created.formatId)
    }

    @Test
    fun `adds version and analyzes deck`() {
        val deck = deckService.createDeck(CreateDeckRequest("Aggro Deck", "format-constructed"))

        deckService.addDeckVersion(
            deck.id,
            AddDeckVersionRequest(
                cards = listOf(
                    DeckCard("ogn-001-298", 4),
                    DeckCard("ogn-002-298", 4),
                    DeckCard("ogn-003-298", 4),
                    DeckCard("ogn-004-298", 4),
                    DeckCard("ogn-005-298", 4),
                    DeckCard("ogn-006-298", 4)
                ),
                notes = "Initial version"
            )
        )

        val result = deckService.analyzeDeck(
            DeckAnalysisRequest(
                deckId = deck.id,
                formatId = "format-constructed",
                analysisType = "summary"
            )
        )

        assertEquals(deck.id, result.deckId)
        assertEquals(24, result.cardCount)
        assertEquals(6, result.uniqueCardCount)
        assertEquals(24, result.manaCurve.values.sum())
    }

    @Test
    fun `lists saved decks`() {
        val firstDeck = deckService.createDeck(CreateDeckRequest("Deck One", "format-constructed"))
        val secondDeck = deckService.createDeck(CreateDeckRequest("Deck Two", "format-constructed"))

        val savedDecks = deckService.getDecks()

        assertEquals(2, savedDecks.size)
        assertEquals(listOf(firstDeck.id, secondDeck.id).sorted(), savedDecks.map { it.id }.sorted())
    }

    @Test
    fun `removes a deck and its versions`() {
        val deck = deckService.createDeck(CreateDeckRequest("Deck to remove", "format-constructed"))
        deckService.addDeckVersion(
            deck.id,
            AddDeckVersionRequest(
                cards = listOf(DeckCard("ogn-001-298", 2)),
                notes = "Initial version"
            )
        )

        val removed = deckService.deleteDeck(deck.id)

        assertEquals(true, removed)
        assertEquals(0, deckService.getDecks().size)
        assertEquals(emptyList<DeckCard>(), deckService.getDeckVersions(deck.id))
    }

    @Test
    fun `loads real card details and only constructed`() {
        val card = deckService.getCard("ogn-001-298")!!
        assertEquals("Blazing Scorcher", card.name)
        assertEquals(5, card.cost)
        assertEquals(listOf("Fury"), card.domains)
        assertTrue(card.text.contains("Accelerate"))
        assertNotNull(card.contentHash)
        assertEquals(listOf("format-constructed"), deckService.getFormats().map { it.id })
        assertEquals(deckService.getCards().size, deckService.getCards().map { it.id }.distinct().size)
    }

    @Test
    fun `costless cards do not appear as zero energy in the curve`() {
        val costless = deckService.getCards().first { it.cost == null }
        val zero = deckService.getCards().first { it.cost == 0 }
        val deck = deckService.createDeck(CreateDeckRequest("Energy test", "format-constructed"))
        deckService.addDeckVersion(deck.id, AddDeckVersionRequest(listOf(
            DeckCard(costless.id, 2), DeckCard(zero.id, 3), DeckCard("ogn-001-298", 1)
        )))
        val result = deckService.analyzeDeck(DeckAnalysisRequest(deck.id, deck.formatId))
        assertEquals(6, result.cardCount)
        assertEquals(mapOf("0" to 3, "5" to 1), result.manaCurve)
    }
}
