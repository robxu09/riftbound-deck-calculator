package com.riftbound.api

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.riftbound.api.controller.DeckController
import com.riftbound.api.domain.*
import com.riftbound.api.service.CardCatalog
import com.riftbound.api.service.DeckService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class DeckCodeTest {
    data class Fixture(val name: String, val code: String, val decoded: DeckCodeCodec.DeckCode, val cards: List<DeckCard> = emptyList())
    data class Fixtures(val reference: String, val cases: List<Fixture>)
    private val mapper = jacksonObjectMapper()
    private val fixtures = mapper.readValue<Fixtures>(javaClass.getResource("/decks/deck-codes.json")!!.readText()).cases
    private val catalog = CardCatalog.load()
    private val importer = DeckCodeImporter(catalog)
    private val exporter = DeckCodeExporter(catalog)
    private fun fixture(name: String) = fixtures.single { it.name == name }

    @Test
    fun decodesPublishedReferenceCodesForEveryVersionAndEncodesByteIdentically() {
        fixtures.forEach { fixture ->
            assertEquals(fixture.decoded, DeckCodeCodec.decode(fixture.code), fixture.name)
            if (!fixture.name.endsWith("v1") && !fixture.name.endsWith("v2")) {
                assertEquals(fixture.code, DeckCodeCodec.encode(fixture.decoded), fixture.name)
            }
        }
    }

    @Test
    fun azirNameListAndReferenceCodeProduceTheSameSixSectionsAndRoundTrip() {
        val original = fixture("azir-v3")
        val text = javaClass.getResource("/decks/azir.txt")!!.readText()
        val byName = DeckTextImporter(catalog).parse(text)
        assertTrue(byName.errors.isEmpty(), byName.errors.toString())
        assertEquals(original.cards.toSet(), byName.cards.toSet())
        assertTrue(byName.warnings.any { it.message.contains("legend title") })
        assertTrue(byName.warnings.any { it.message.contains("Multiple printings") })
        val byCode = importer.parse(original.code)
        assertTrue(byCode.errors.isEmpty(), byCode.errors.toString())
        assertEquals(original.cards.toSet(), byCode.cards.toSet())
        assertTrue(byCode.warnings.isEmpty())
        assertEquals(original.code, exporter.export(byName.cards))
        assertEquals(mapOf(DeckSection.LEGEND to 1, DeckSection.CHAMPION to 1, DeckSection.MAIN_DECK to 39,
            DeckSection.BATTLEFIELDS to 3, DeckSection.RUNES to 12, DeckSection.SIDEBOARD to 10),
            byCode.cards.groupBy { it.section }.mapValues { (_, entries) -> entries.sumOf { it.quantity } })
    }

    @Test
    fun championIsMovedFromMainRatherThanDuplicatedAndSideboardStaysSeparate() {
        val code = DeckCodeCodec.encode(DeckCodeCodec.DeckCode(
            listOf(DeckCodeCodec.Entry("SFD-177", 3)), listOf(DeckCodeCodec.Entry("SFD-177", 1)), "SFD-177"))
        val result = importer.parse(code)
        assertTrue(result.errors.isEmpty())
        assertEquals(setOf(DeckCard("sfd-177-221", 1, DeckSection.CHAMPION), DeckCard("sfd-177-221", 2),
            DeckCard("sfd-177-221", 1, DeckSection.SIDEBOARD)), result.cards.toSet())
        assertEquals(code, exporter.export(result.cards))
    }

    @Test
    fun supportsWhitespaceLowercaseRunesSpecialCardsAndHighCounts() {
        for (name in listOf("rune-v4", "high-count-v5", "special-v5", "empty-v3")) {
            val fixture = fixture(name)
            val result = importer.parse(" \n" + fixture.code.lowercase().chunked(20).joinToString("\n") + "\n")
            assertTrue(result.errors.isEmpty(), result.errors.toString())
            assertEquals(fixture.code, exporter.export(result.cards), name)
        }
    }

    @Test
    fun missingPrintingsUnknownSetsAndUnrepresentableDecksAreNeverSilentlyDropped() {
        val unknown = importer.parse(DeckCodeCodec.encode(DeckCodeCodec.DeckCode(listOf(DeckCodeCodec.Entry("OGN-999", 1)))))
        assertTrue(unknown.errors.single().message.contains("OGN-999"))
        val extraLegends = importer.parse(fixture("additional-legends-v6").code)
        assertTrue(extraLegends.errors.any { it.message.contains("additional legends") })
        for (entries in listOf(listOf(DeckCard("missing")), listOf(DeckCard("sfd-177-221", 0)),
            listOf(DeckCard("sfd-177-221", 2, DeckSection.CHAMPION)), listOf(DeckCard("ogn-042-298", 12)))) {
            assertThrows(IllegalArgumentException::class.java) { exporter.export(entries) }
        }
    }

    @Test
    fun cosmeticVariantFallbackIsDisclosedButExistingPrintingsArePreserved() {
        val result = importer.parse(fixture("variants-v4").code)
        assertTrue(result.errors.isEmpty(), result.errors.toString())
        assertEquals(12, result.cards.single { it.cardId == "rad-r02a" }.quantity)
        assertEquals(4, result.cards.single { it.cardId == "ogn-001-298" }.quantity)
        assertEquals(3, result.warnings.count { it.message.contains("artwork is unavailable") })
    }

    @Test
    fun doesNotGuessMissingChampionsOrAddChampionsOutsideTheMainDeck() {
        val legacy = importer.parse(fixture("azir-legacy-v1").code)
        assertTrue(legacy.errors.isEmpty())
        assertTrue(legacy.cards.none { it.section == DeckSection.CHAMPION })
        assertTrue(legacy.warnings.any { it.message.contains("does not specify a chosen champion") })
        val absent = importer.parse(DeckCodeCodec.encode(DeckCodeCodec.DeckCode(emptyList(), chosenChampion = "SFD-177")))
        assertTrue(absent.errors.single().message.contains("included"))
    }

    @Test
    fun rejectsTruncationTrailingDataInvalidFlagsUnknownIdentifiersAndHugeLengths() {
        val valid = fixture("azir-v3").code
        for (code in listOf("", "not a code!", valid.dropLast(5), valid + "AA", "A".repeat(100001))) {
            assertTrue(importer.parse(code).errors.isNotEmpty(), code.take(30))
        }
        // Minimal v5 bodies isolate invalid wire fields without unbounded loops.
        val badBytes = listOf(
            listOf(0x10), listOf(0x17), listOf(0x23), listOf(0x15, 2),
            listOf(0x15, 0, 1, 1, 1, 1, 99, 0, 1, 0, 0), // unknown set
            listOf(0x15, 0, 1, 1, 1, 1, 0, 99, 1, 0, 0), // unknown variant
            listOf(0x15, 1, 1, 1, 1, 1, 0, 0, 3, 1, 0, 0), // unknown prefix
            listOf(0x15, 0, 0, 0, 2), // invalid champion flag
            listOf(0x15, 0, 255, 255, 255, 255, 127), // oversized integer
            listOf(0x15, 0, 127) // claimed groups exceed remaining bytes
        )
        badBytes.forEach { assertTrue(importer.parse(base32(it)).errors.isNotEmpty(), it.toString()) }
    }

    @Test
    fun apiAutoDetectsWithoutSavingAndExportsOnlyTheLatestSavedVersion() {
        val service = DeckService()
        val original = fixture("azir-v3")
        val mvc = MockMvcBuilders.standaloneSetup(DeckController(service)).build()
        for (input in listOf(original.code, javaClass.getResource("/decks/azir.txt")!!.readText())) {
            mvc.perform(post("/api/decks/import-preview").contentType("application/json")
                .content(mapper.writeValueAsString(DeckImportRequest(input))))
                .andExpect(status().isOk).andExpect(jsonPath("$.errors").isEmpty)
                .andExpect(jsonPath("$.cardNames['sfd-177-221']").value("Azir, Sovereign"))
        }
        assertTrue(service.getDecks().isEmpty())
        val deck = service.createDeck(CreateDeckRequest("Azir", "format-constructed"))
        service.addDeckVersion(deck.id, AddDeckVersionRequest(original.cards))
        mvc.perform(get("/api/decks/${deck.id}/export-code")).andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith("text/plain")).andExpect(content().string(original.code))
        mvc.perform(get("/api/decks/missing/export-code")).andExpect(status().isNotFound)
        service.addDeckVersion(deck.id, AddDeckVersionRequest(listOf(DeckCard("missing"))))
        mvc.perform(get("/api/decks/${deck.id}/export-code")).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").exists())
        mvc.perform(post("/api/decks/import-preview").contentType("application/json")
            .content("""{"text":"invalid-code!"}"""))
            .andExpect(status().isOk).andExpect(jsonPath("$.errors").isNotEmpty)
    }

    private fun base32(bytes: List<Int>): String {
        val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        val bits = bytes.joinToString("") { it.toString(2).padStart(8, '0') }
        return bits.chunked(5).joinToString("") { alphabet[it.padEnd(5, '0').toInt(2)].toString() }
    }
}
