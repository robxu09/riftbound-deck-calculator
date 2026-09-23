package com.riftbound.api.controller

import com.riftbound.api.domain.AddDeckVersionRequest
import com.riftbound.api.domain.CreateDeckRequest
import com.riftbound.api.domain.DeckAnalysisRequest
import com.riftbound.api.domain.DeckImportRequest
import com.riftbound.api.domain.DuplicateDeckNameException
import com.riftbound.api.domain.DeckNameRequest
import com.riftbound.api.domain.DeckNotFoundException
import com.riftbound.api.service.DeckService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.http.MediaType

@RestController
@CrossOrigin(origins = ["http://localhost:4200"], allowCredentials = "true")
@RequestMapping("/api")
class DeckController(
    private val deckService: DeckService
) {

    @GetMapping("/cards")
    fun getCards() = deckService.getCards()

    @GetMapping("/cards/{cardId}")
    fun getCard(@PathVariable cardId: String) = deckService.getCard(cardId)

    @GetMapping("/formats")
    fun getFormats() = deckService.getFormats()

    @PostMapping("/decks/import-preview")
    fun previewImport(@RequestBody request: DeckImportRequest) = deckService.previewImport(request.text)

    @GetMapping("/decks")
    fun getDecks() = deckService.getDecks()

    @PostMapping("/decks")
    fun createDeck(@RequestBody request: CreateDeckRequest): ResponseEntity<*> = try {
        ResponseEntity.ok(deckService.createDeck(request))
    } catch (e: DuplicateDeckNameException) {
        ResponseEntity.status(409).body(mapOf("error" to e.message))
    } catch (e: IllegalArgumentException) {
        ResponseEntity.badRequest().body(mapOf("error" to e.message))
    }

    @GetMapping("/decks/{deckId}")
    fun getDeck(@PathVariable deckId: String) = deckService.getDeck(deckId)

    @PostMapping("/decks/{deckId}/rename")
    fun renameDeck(@PathVariable deckId: String, @RequestBody request: DeckNameRequest) =
        deckService.renameDeck(deckId, request.name)

    @PostMapping("/decks/{deckId}/duplicate")
    fun duplicateDeck(@PathVariable deckId: String, @RequestBody request: DeckNameRequest) =
        deckService.duplicateDeck(deckId, request.name)

    @GetMapping("/decks/{deckId}/export")
    fun exportDeck(@PathVariable deckId: String): ResponseEntity<String> = ResponseEntity.ok()
        .contentType(MediaType("text", "plain", Charsets.UTF_8))
        .body(deckService.exportDeck(deckId))

    @ExceptionHandler(DuplicateDeckNameException::class)
    fun duplicateName(error: DuplicateDeckNameException) = ResponseEntity.status(409).body(mapOf("error" to error.message))

    @ExceptionHandler(DeckNotFoundException::class)
    fun missingDeck(error: DeckNotFoundException) = ResponseEntity.status(404).body(mapOf("error" to error.message))

    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidRequest(error: IllegalArgumentException) = ResponseEntity.badRequest().body(mapOf("error" to error.message))

    @PostMapping("/decks/{deckId}/delete")
    fun deleteDeck(@PathVariable deckId: String): ResponseEntity<Map<String, Boolean>> {
        val deleted = deckService.deleteDeck(deckId)
        return ResponseEntity.ok(mapOf("deleted" to deleted))
    }

    @GetMapping("/decks/{deckId}/versions")
    fun getDeckVersions(@PathVariable deckId: String) = deckService.getDeckVersions(deckId)

    @PostMapping("/decks/{deckId}/versions")
    fun addDeckVersion(
        @PathVariable deckId: String,
        @RequestBody request: AddDeckVersionRequest
    ) = deckService.addDeckVersion(deckId, request)

    @PostMapping("/analysis")
    fun analyzeDeck(@RequestBody request: DeckAnalysisRequest): ResponseEntity<*> {
        return try {
            ResponseEntity.ok(deckService.analyzeDeck(request))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }
}
