package com.riftbound.api.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.riftbound.api.domain.*
import com.riftbound.api.persistence.DeckEntity
import com.riftbound.api.persistence.DeckRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class SideboardPlanService(private val decks: DeckRepository, private val deckService: DeckService) {
    private val mapper = jacksonObjectMapper()
    private fun plans(deck: DeckEntity): List<SideboardPlan> =
        mapper.readValue(deck.sideboardPlansJson ?: "[]", Array<SideboardPlan>::class.java).toList()

    @Transactional(readOnly = true)
    fun list(deckId: String): List<SideboardPlan> = plans(decks.findById(deckId).orElseThrow { DeckNotFoundException(deckId) })

    @Transactional
    fun save(deckId: String, request: SaveSideboardPlanRequest, planId: String? = null): SideboardPlan {
        val deck = decks.findForPlanUpdate(deckId) ?: throw DeckNotFoundException(deckId)
        val current = plans(deck)
        require(planId == null || current.any { it.id == planId }) { "Sideboard plan not found." }
        val name = request.name.trim()
        require(name.isNotEmpty() && name.length <= 80) { "Use a plan name between 1 and 80 characters." }
        require(current.none { it.id != planId && it.name.equals(name, ignoreCase = true) }) { "A plan with that name already exists." }
        val latest = deckService.getDeckVersions(deckId).lastOrNull()
        require(latest != null && latest.id == request.baseVersionId) { "The saved deck changed. Reload analysis before saving a plan." }
        validateSideboardSwaps(latest.cards, request.swaps, deckService.getCards().associateBy { it.id })
        val plan = SideboardPlan(planId ?: UUID.randomUUID().toString(), name, latest.id, request.swaps)
        deck.sideboardPlansJson = mapper.writeValueAsString(current.filterNot { it.id == plan.id } + plan)
        decks.save(deck)
        return plan
    }

    @Transactional
    fun delete(deckId: String, planId: String): Boolean {
        val deck = decks.findForPlanUpdate(deckId) ?: throw DeckNotFoundException(deckId)
        val current = plans(deck)
        val remaining = current.filterNot { it.id == planId }
        if (remaining.size == current.size) return false
        deck.sideboardPlansJson = mapper.writeValueAsString(remaining)
        decks.save(deck)
        return true
    }
}
