package com.riftbound.api

import com.riftbound.api.controller.DeckController
import com.riftbound.api.domain.AddDeckVersionRequest
import com.riftbound.api.domain.CreateDeckRequest
import com.riftbound.api.domain.DeckAnalysisRequest
import com.riftbound.api.domain.DeckCard
import com.riftbound.api.domain.DeckSection
import com.riftbound.api.domain.DuplicateDeckNameException
import com.riftbound.api.persistence.DeckRepository
import com.riftbound.api.persistence.DeckVersionRepository
import com.riftbound.api.service.DeckService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest(properties = [
    "spring.datasource.url=jdbc:h2:mem:deck-service-tests;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop"
])
class DeckServiceTest {

    @Autowired
    private lateinit var deckService: DeckService

    @Autowired
    private lateinit var deckRepository: DeckRepository

    @Autowired
    private lateinit var deckVersionRepository: DeckVersionRepository

    @BeforeEach
    fun resetDatabase() {
        deckVersionRepository.deleteAll()
        deckRepository.deleteAll()
    }

    @Test
    fun `rename retains history and updates name uniqueness`() {
        val original = deckService.createDeck(CreateDeckRequest("Before", "format-constructed", listOf(DeckCard("ogn-126-298", 6, DeckSection.RUNES))))
        val versions = deckService.getDeckVersions(original.id)
        val renamed = deckService.renameDeck(original.id, " After ")
        assertEquals(original.copy(name = "After"), renamed)
        assertEquals(versions, deckService.getDeckVersions(original.id))
        assertEquals("AFTER", deckService.renameDeck(original.id, "AFTER").name)
        assertThrows(DuplicateDeckNameException::class.java) { deckService.createDeck(CreateDeckRequest(" after ", "format-constructed")) }
        deckService.createDeck(CreateDeckRequest("Before", "format-constructed"))
        assertThrows(DuplicateDeckNameException::class.java) { deckService.renameDeck(original.id, "Before") }
        assertEquals("AFTER", deckService.getDeck(original.id)!!.name)
    }

    @Test
    fun `duplicate copies only latest saved version and remains independent`() {
        val original = deckService.createDeck(CreateDeckRequest("Original", "format-constructed"))
        val cards = listOf(DeckCard("ven-sp3-006", 1, DeckSection.CHAMPION), DeckCard("ogn-126-298", 6, DeckSection.RUNES))
        deckService.addDeckVersion(original.id, AddDeckVersionRequest(cards))
        val copy = deckService.duplicateDeck(original.id, "Copy")
        assertTrue(copy.id != original.id)
        assertEquals(original.formatId, copy.formatId)
        assertEquals(cards, deckService.getDeckVersions(copy.id).single().cards)
        deckService.addDeckVersion(copy.id, AddDeckVersionRequest(emptyList()))
        assertEquals(cards, deckService.getDeckVersions(original.id).last().cards)
        assertThrows(DuplicateDeckNameException::class.java) { deckService.duplicateDeck(original.id, " copy ") }
        assertEquals(2, deckService.getDecks().size)
        deckService.deleteDeck(copy.id)
        assertNotNull(deckService.getDeck(original.id))
    }

    @Test
    fun `duplicate names ignore case and surrounding whitespace without changing saved decks`() {
        val deck = deckService.createDeck(CreateDeckRequest("  Ambessa  ", "format-constructed"))
        assertEquals("Ambessa", deck.name)
        for (name in listOf("Ambessa", "ambessa", " AMBESSA ")) {
            assertThrows(DuplicateDeckNameException::class.java) {
                deckService.createDeck(CreateDeckRequest(name, "format-constructed"))
            }
        }
        assertEquals(listOf(deck), deckService.getDecks())
        assertEquals(1, deckService.getDeckVersions(deck.id).size)
        deckService.deleteDeck(deck.id)
        assertEquals("ambessa", deckService.createDeck(CreateDeckRequest("ambessa", "format-constructed")).name)
    }

    @Test
    fun `creates empty and populated decks independently with initial versions`() {
        val cards = listOf(DeckCard("ogn-126-298", 6, DeckSection.RUNES))
        val imported = deckService.createDeck(CreateDeckRequest("Imported", "format-constructed", cards))
        val empty = deckService.createDeck(CreateDeckRequest("Empty", "format-constructed"))
        assertEquals(cards, deckService.getDeckVersions(imported.id).single().cards)
        assertTrue(deckService.getDeckVersions(empty.id).single().cards.isEmpty())
    }

    @Test
    fun `creation returns conflict for duplicates and bad request for blank names`() {
        val controller = DeckController(deckService)
        assertEquals(200, controller.createDeck(CreateDeckRequest("Test", "format-constructed")).statusCode.value())
        val conflict = controller.createDeck(CreateDeckRequest(" test ", "format-constructed"))
        assertEquals(409, conflict.statusCode.value())
        assertTrue((conflict.body as Map<*, *>) ["error"].toString().contains("already exists"))
        assertEquals(400, controller.createDeck(CreateDeckRequest("  ", "format-constructed")).statusCode.value())
        assertEquals(1, deckService.getDecks().size)
    }

    @Test
    fun `concurrent requests cannot create duplicate names`() {
        val executor = java.util.concurrent.Executors.newFixedThreadPool(2)
        val ready = java.util.concurrent.CountDownLatch(2)
        val start = java.util.concurrent.CountDownLatch(1)
        try {
            val results = (1..2).map {
                executor.submit<Boolean> {
                    ready.countDown()
                    start.await()
                    try {
                        deckService.createDeck(CreateDeckRequest("Concurrent", "format-constructed"))
                        true
                    } catch (_: DuplicateDeckNameException) { false }
                }
            }
            assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS))
            start.countDown()
            assertEquals(1, results.count { it.get(5, java.util.concurrent.TimeUnit.SECONDS) })
            assertEquals(1, deckService.getDecks().size)
        } finally {
            start.countDown()
            executor.shutdownNow()
        }
    }

    @Test
    fun `deck state is shared through the repositories`() {
        val created = deckService.createDeck(CreateDeckRequest("Persisted Deck", "format-constructed"))
        deckService.addDeckVersion(created.id, AddDeckVersionRequest(listOf(DeckCard("ogn-001-298", 2)), "Saved"))

        val restarted = DeckService(deckRepository, deckVersionRepository)

        assertEquals(listOf("Persisted Deck"), restarted.getDecks().map { it.name })
        assertEquals(2, restarted.getDeckVersions(created.id).size)
    }

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
    fun `retains printing IDs for imports saved decks and analysis`() {
        val printing = deckService.getCard("ven-sp3-006")!!
        assertEquals("Ahri, Inquisitive", printing.name)
        assertTrue(deckService.getCards().any { it.id == printing.id })
        val imported = deckService.previewImport("MainDeck:\n2 Ahri, Inquisitive [VEN-SP3/006]")
        assertTrue(imported.errors.isEmpty())
        assertEquals(printing.id, imported.cards.single().cardId)
        val deck = deckService.createDeck(CreateDeckRequest("Alternate printing", "format-constructed", imported.cards))
        assertEquals(imported.cards, deckService.getDeckVersions(deck.id).single().cards)
        val analysis = deckService.analyzeDeck(DeckAnalysisRequest(deck.id, deck.formatId))
        assertEquals(mapOf(printing.cost.toString() to 2), analysis.manaCurve)
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
