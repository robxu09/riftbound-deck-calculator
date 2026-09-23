package com.riftbound.api

import com.riftbound.api.domain.*
import com.riftbound.api.service.DeckService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.WebApplicationType
import org.springframework.boot.builder.SpringApplicationBuilder
import java.nio.file.Path

class DeckPersistenceRestartTest {
    @TempDir
    lateinit var directory: Path

    private fun start() = SpringApplicationBuilder(RiftboundApiApplication::class.java)
        .web(WebApplicationType.NONE)
        .run(
            "--spring.datasource.url=jdbc:h2:file:${directory.resolve("restart").toAbsolutePath()};DB_CLOSE_ON_EXIT=FALSE",
            "--spring.jpa.hibernate.ddl-auto=update",
            "--spring.h2.console.enabled=false",
            "--spring.main.banner-mode=off"
        )

    @Test
    fun `decks versions sections and deletions survive closing and reopening the application`() {
        lateinit var deck: Deck
        lateinit var versions: List<DeckVersion>
        val initial = listOf(DeckCard("ven-sp3-006", 1, DeckSection.CHAMPION))
        val revised = initial + DeckCard("ogn-126-298", 6, DeckSection.RUNES)
        start().use { context ->
            val service = context.getBean(DeckService::class.java)
            deck = service.createDeck(CreateDeckRequest("Restart deck", "format-constructed", initial))
            service.addDeckVersion(deck.id, AddDeckVersionRequest(revised, "Added runes"))
            versions = service.getDeckVersions(deck.id)
        }
        start().use { context ->
            val service = context.getBean(DeckService::class.java)
            assertEquals(deck, service.getDeck(deck.id))
            assertEquals(versions, service.getDeckVersions(deck.id))
            assertEquals(revised, service.getDeckVersions(deck.id).last().cards)
            assertThrows(DuplicateDeckNameException::class.java) {
                service.createDeck(CreateDeckRequest(" RESTART DECK ", "format-constructed"))
            }
            assertTrue(service.deleteDeck(deck.id))
        }
        start().use { context ->
            val service = context.getBean(DeckService::class.java)
            assertNull(service.getDeck(deck.id))
            assertTrue(service.getDeckVersions(deck.id).isEmpty())
        }
    }
}
