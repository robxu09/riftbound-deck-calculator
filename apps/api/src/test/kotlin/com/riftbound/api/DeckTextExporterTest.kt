package com.riftbound.api

import com.riftbound.api.domain.*
import com.riftbound.api.service.CardCatalog
import com.riftbound.api.service.DeckService
import com.riftbound.api.controller.DeckController
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

class DeckTextExporterTest {
    private val catalog = CardCatalog.load()
    private val importer = DeckTextImporter(catalog)
    private val exporter = DeckTextExporter(catalog)

    @Test
    fun `example round trips with all six sections exact printing IDs and quantities`() {
        val text = javaClass.getResource("/decks/ambessa.txt")!!.readText()
        val original = importer.parse(text).cards
        val exported = exporter.export(original)
        val imported = importer.parse(exported)
        assertTrue(exported.contains("[VEN-153-166]"))
        assertEquals(original, imported.cards)
        assertTrue(imported.errors.isEmpty())
        assertTrue(imported.warnings.isEmpty())
    }

    @Test
    fun `empty decks and repeated cards across sections round trip`() {
        val empty = importer.parse(exporter.export(emptyList()))
        assertTrue(empty.errors.isEmpty())
        assertTrue(empty.cards.isEmpty())
        val entries = listOf(DeckCard("ven-sp3-006", 2), DeckCard("ven-sp3-006", 1, DeckSection.SIDEBOARD), DeckCard("ogn-126-298", 1001, DeckSection.RUNES))
        val actual = importer.parse(exporter.export(entries))
        assertTrue(actual.errors.isEmpty())
        assertEquals(entries.toSet(), actual.cards.toSet())
    }

    @Test
    fun `unknown IDs and invalid quantities fail without silently dropping entries`() {
        assertThrows(IllegalArgumentException::class.java) { exporter.export(listOf(DeckCard("missing"))) }
        assertThrows(IllegalArgumentException::class.java) { exporter.export(listOf(DeckCard("ogn-126-298", 0))) }
    }

    @Test
    fun `HTTP export is text and management failures have useful statuses`() {
        val service = DeckService()
        val deck = service.createDeck(CreateDeckRequest("Original", "format-constructed"))
        service.createDeck(CreateDeckRequest("Taken", "format-constructed"))
        val mvc = MockMvcBuilders.standaloneSetup(DeckController(service)).build()
        mvc.perform(get("/api/decks/${deck.id}/export")).andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith("text/plain"))
            .andExpect(content().string(exporter.export(emptyList())))
        mvc.perform(post("/api/decks/${deck.id}/rename").contentType("application/json").content("""{"name":"Taken"}"""))
            .andExpect(status().isConflict).andExpect(jsonPath("$.error").exists())
        mvc.perform(post("/api/decks/${deck.id}/duplicate").contentType("application/json").content("""{"name":" "}"""))
            .andExpect(status().isBadRequest)
        for (route in listOf("rename", "duplicate")) {
            mvc.perform(post("/api/decks/missing/$route").contentType("application/json").content("""{"name":"New"}"""))
                .andExpect(status().isNotFound)
        }
        mvc.perform(get("/api/decks/missing/export")).andExpect(status().isNotFound)
    }
}
