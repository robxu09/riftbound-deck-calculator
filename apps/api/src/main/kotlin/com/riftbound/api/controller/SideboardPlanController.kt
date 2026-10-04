package com.riftbound.api.controller

import com.riftbound.api.domain.DeckNotFoundException
import com.riftbound.api.domain.SaveSideboardPlanRequest
import com.riftbound.api.service.SideboardPlanService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@CrossOrigin(origins = ["http://localhost:4200"], allowCredentials = "true")
@RequestMapping("/api/decks/{deckId}/sideboard-plans")
class SideboardPlanController(private val plans: SideboardPlanService) {
    @GetMapping
    fun list(@PathVariable deckId: String) = plans.list(deckId)
    @PostMapping
    fun create(@PathVariable deckId: String, @RequestBody request: SaveSideboardPlanRequest) = plans.save(deckId, request)
    @PostMapping("/{planId}")
    fun update(@PathVariable deckId: String, @PathVariable planId: String, @RequestBody request: SaveSideboardPlanRequest) = plans.save(deckId, request, planId)
    @PostMapping("/{planId}/delete")
    fun delete(@PathVariable deckId: String, @PathVariable planId: String) = mapOf("deleted" to plans.delete(deckId, planId))
    @ExceptionHandler(DeckNotFoundException::class)
    fun missing(error: DeckNotFoundException) = ResponseEntity.status(404).body(mapOf("error" to error.message))
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalid(error: IllegalArgumentException) = ResponseEntity.badRequest().body(mapOf("error" to error.message))
}
