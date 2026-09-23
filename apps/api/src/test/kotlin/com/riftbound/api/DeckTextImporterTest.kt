package com.riftbound.api

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.riftbound.api.domain.*
import com.riftbound.api.service.CardCatalog
import com.riftbound.api.service.DeckService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DeckTextImporterTest {
    private val importer = DeckTextImporter(CardCatalog.load())
    private fun example() = javaClass.getResource("/decks/ambessa.txt")!!.readText()

    @Test
    fun `imports user example and preserves sections through saving and analysis`() {
        val result = importer.parse(example())
        assertEquals(emptyList<DeckImportIssue>(), result.errors)
        assertEquals(mapOf(DeckSection.LEGEND to 1, DeckSection.CHAMPION to 1,
            DeckSection.MAIN_DECK to 39, DeckSection.BATTLEFIELDS to 3,
            DeckSection.RUNES to 12, DeckSection.SIDEBOARD to 10),
            result.cards.groupBy { it.section }.mapValues { (_, cards) -> cards.sumOf { it.quantity } })
        assertEquals("ven-153-166", result.cards.first().cardId)
        assertTrue(result.warnings.any { it.message.contains("Matriarch of War") })
        val service = DeckService(null, null)
        assertTrue(service.getDecks().isEmpty())
        service.previewImport(example())
        assertTrue(service.getDecks().isEmpty())
        val deck = service.createDeck(CreateDeckRequest("Imported Ambessa", "format-constructed"))
        service.addDeckVersion(deck.id, AddDeckVersionRequest(result.cards))
        assertEquals(result.cards, service.getDeckVersions(deck.id).last().cards)
        val analysis = service.analyzeDeck(DeckAnalysisRequest(deck.id, deck.formatId))
        assertEquals(66, analysis.cardCount)
        assertTrue(analysis.warnings.isEmpty())
        val catalog = service.getCards().associateBy { it.id }
        val mainCount = result.cards.filter { it.section in setOf(DeckSection.MAIN_DECK, DeckSection.CHAMPION) }
            .filter { catalog[it.cardId]?.cost != null }.sumOf { it.quantity }
        assertEquals(mainCount, analysis.manaCurve.values.sum())
    }

    @Test
    fun `does not enforce game copy limits or target counts`() {
        val result = importer.parse("MainDeck:\n40 Blazing Scorcher [OGN-001]\nRunes:\n12 Body Rune [OGN-126]")
        assertTrue(result.errors.isEmpty())
        assertEquals(52, result.cards.sumOf { it.quantity })
    }

    @Test
    fun `handles BOM CRLF whitespace case and repeated rows without merging sections`() {
        val result = importer.parse("\uFEFF main deck: \r\n1 Blazing Scorcher [ogn-001]\r\n2 Blazing Scorcher [OGN-001/298]\r\nSideboard:\r\n1 Blazing Scorcher [ogn-001-298]")
        assertTrue(result.errors.isEmpty())
        assertEquals(listOf(DeckCard("ogn-001-298", 3), DeckCard("ogn-001-298", 1, DeckSection.SIDEBOARD)), result.cards)
    }

    @Test
    fun `reports invalid lines and never falls back from unknown codes to names`() {
        val result = importer.parse("MainDeck:\n0 Blazing Scorcher [OGN-001]\n1 Blazing Scorcher [BAD-001]\nbroken\nMystery:\n1 Blazing Scorcher [OGN-001]")
        assertEquals(listOf(2, 3, 4, 5, 6), result.errors.map { it.line })
        assertTrue(result.cards.isEmpty())
        assertTrue(importer.parse("").errors.isNotEmpty())
        assertTrue(importer.parse("x".repeat(100001)).errors.isNotEmpty())
    }

    @Test
    fun `rejects ambiguous short codes and does not confuse numeric prefixes`() {
        val cards = listOf(Card("set-001-100", "First", "Unit", 1, "", "SET"),
            Card("set-001-200", "Second", "Unit", 1, "", "SET"))
        val parser = DeckTextImporter(cards)
        assertTrue(parser.parse("MainDeck:\n1 First [SET-001]").errors.single().message.contains("Ambiguous"))
        assertTrue(parser.parse("MainDeck:\n1 First [SET-00]").cards.isEmpty())
        assertEquals("set-001-100", parser.parse("MainDeck:\n1 First [SET-001-100]").cards.single().cardId)
    }

    @Test
    fun `legacy deck entries default to main deck and sections round trip in JSON`() {
        val mapper = jacksonObjectMapper()
        val old = mapper.readValue<DeckCard>("""{"cardId":"ogn-001-298","quantity":2}""")
        assertEquals(DeckSection.MAIN_DECK, old.section)
        val side = old.copy(section = DeckSection.SIDEBOARD)
        assertEquals(side, mapper.readValue<DeckCard>(mapper.writeValueAsString(side)))
    }
}
