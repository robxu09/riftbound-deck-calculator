package com.riftbound.api

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.riftbound.api.domain.*
import com.riftbound.api.persistence.DeckRepository
import com.riftbound.api.persistence.DeckVersionRepository
import com.riftbound.api.service.DeckService
import com.riftbound.api.service.SideboardPlanService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.http.MediaType

@SpringBootTest(properties = ["spring.datasource.url=jdbc:h2:mem:sideboard-tests;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop"])
@AutoConfigureMockMvc
class SideboardPlanTest {
    @Autowired lateinit var decks: DeckService
    @Autowired lateinit var plans: SideboardPlanService
    @Autowired lateinit var repository: DeckRepository
    @Autowired lateinit var versions: DeckVersionRepository
    @Autowired lateinit var mvc: MockMvc
    private val mapper = jacksonObjectMapper()
    @BeforeEach fun clear() { versions.deleteAll(); repository.deleteAll() }

    @Test fun plansPreserveVersionsAndValidateNamesScopeAndStaleness() {
        val units = decks.getCards().filter { it.type == "Unit" }.take(2)
        val entries = listOf(DeckCard(units[0].id, 39), DeckCard(units[1].id, 2, DeckSection.SIDEBOARD))
        val deck = decks.createDeck(CreateDeckRequest("Plans", "format-constructed", entries))
        val other = decks.createDeck(CreateDeckRequest("Other", "format-constructed", entries))
        val original = decks.getDeckVersions(deck.id)
        val request = SaveSideboardPlanRequest(" Aggro ", original.last().id, listOf(SideboardSwap(units[0].id, units[1].id)))
        val url = "/api/decks/" + deck.id + "/sideboard-plans"
        val response = mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
            .andExpect(status().isOk).andReturn().response.contentAsString
        val plan = mapper.readValue(response, SideboardPlan::class.java)
        assertEquals("Aggro", plan.name)
        assertEquals(listOf(plan), plans.list(deck.id))
        assertEquals(original, decks.getDeckVersions(deck.id))
        assertThrows(IllegalArgumentException::class.java) { plans.save(deck.id, request.copy(name = " aggro ")) }
        assertThrows(IllegalArgumentException::class.java) { plans.save(deck.id, request.copy(name = " ")) }
        assertThrows(IllegalArgumentException::class.java) { plans.save(deck.id, request.copy(swaps = request.swaps + request.swaps + request.swaps), plan.id) }
        assertThrows(IllegalArgumentException::class.java) { plans.save(other.id, request, plan.id) }
        assertFalse(plans.delete(other.id, plan.id))
        mvc.perform(get("/api/decks/missing/sideboard-plans")).andExpect(status().isNotFound)
        mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request.copy(name = "Invalid", swaps = emptyList())))).andExpect(status().isBadRequest)
        val updated = plans.save(deck.id, request.copy(name = "Control", swaps = request.swaps + request.swaps), plan.id)
        assertEquals(plan.id, updated.id)
        assertEquals(2, plans.list(deck.id).single().swaps.size)
        decks.addDeckVersion(deck.id, AddDeckVersionRequest(entries))
        assertThrows(IllegalArgumentException::class.java) { plans.save(deck.id, request, plan.id) }
        assertEquals(updated, plans.list(deck.id).single())
        assertTrue(plans.delete(deck.id, plan.id))
        assertTrue(plans.list(deck.id).isEmpty())
        plans.save(deck.id, request.copy(baseVersionId = decks.getDeckVersions(deck.id).last().id))
        assertTrue(decks.deleteDeck(deck.id))
        assertThrows(DeckNotFoundException::class.java) { plans.list(deck.id) }
    }

    @Test fun swapsRejectProtectedCardsMissingCopiesAndChaining() {
        val u = Card("u", "Unit", "Unit", 2, "", "VEN")
        val s = u.copy(id = "s", type = "Spell")
        val rune = u.copy(id = "r", type = "Rune")
        val cards = listOf(u, s, rune).associateBy { it.id }
        val entries = listOf(DeckCard("u", 39), DeckCard("s", 1, DeckSection.SIDEBOARD), DeckCard("r", 12, DeckSection.RUNES))
        validateSideboardSwaps(entries, listOf(SideboardSwap("u", "s")), cards)
        for (swap in listOf(SideboardSwap("u", "r"), SideboardSwap("r", "s"), SideboardSwap("u", "u"), SideboardSwap("u", "missing"))) {
            assertThrows(IllegalArgumentException::class.java) { validateSideboardSwaps(entries, listOf(swap), cards) }
        }
        assertThrows(IllegalArgumentException::class.java) { validateSideboardSwaps(entries, listOf(SideboardSwap("u", "s"), SideboardSwap("s", "u")), cards) }
        assertThrows(IllegalArgumentException::class.java) { validateSideboardSwaps(entries.drop(1), listOf(SideboardSwap("u", "s")), cards) }
    }
}
