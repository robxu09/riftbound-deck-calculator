package com.riftbound.api.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.riftbound.api.domain.AddDeckVersionRequest
import com.riftbound.api.domain.Card
import com.riftbound.api.domain.CreateDeckRequest
import com.riftbound.api.domain.Deck
import com.riftbound.api.domain.DeckAnalysisRequest
import com.riftbound.api.domain.DeckAnalysisResult
import com.riftbound.api.domain.DeckCard
import com.riftbound.api.domain.DeckSection
import com.riftbound.api.domain.DeckTextImporter
import com.riftbound.api.domain.DeckTextExporter
import com.riftbound.api.domain.DeckNotFoundException
import com.riftbound.api.domain.DeckVersion
import com.riftbound.api.domain.DuplicateDeckNameException
import com.riftbound.api.domain.Format
import com.riftbound.api.persistence.DeckEntity
import com.riftbound.api.persistence.DeckRepository
import com.riftbound.api.persistence.DeckVersionEntity
import com.riftbound.api.persistence.DeckVersionRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class DeckService(
    private val deckRepository: DeckRepository? = null,
    private val deckVersionRepository: DeckVersionRepository? = null
) {
    private val fallbackDecks = mutableMapOf<String, Deck>()
    private val fallbackDeckVersions = mutableMapOf<String, MutableList<DeckVersion>>()

    private val cards = CardCatalog.load()
    private val textImporter = DeckTextImporter(cards)
    private val textExporter = DeckTextExporter(cards)
    private val objectMapper = jacksonObjectMapper()
    private val formats = mutableListOf(
        Format("format-constructed", "Constructed", 60, 30, 3, "1.0")
    )

    fun previewImport(text: String) = textImporter.parse(text)

    fun getCards(): List<Card> = cards.toList()

    fun getCard(id: String): Card? = cards.firstOrNull { it.id == id }

    fun getFormats(): List<Format> = formats.toList()

    @Synchronized
    @Transactional
    fun renameDeck(deckId: String, requestedName: String): Deck {
        val name = requestedName.trim()
        require(name.isNotEmpty()) { "Enter a deck name." }
        require(name.length <= 255) { "Deck names must be at most 255 characters." }
        if (deckRepository != null) {
            val entity = deckRepository.findById(deckId).orElseThrow { DeckNotFoundException(deckId) }
            if (deckRepository.existsByNormalizedNameAndIdNot(name.lowercase(), deckId)) throw DuplicateDeckNameException(name)
            entity.name = name
            entity.normalizedName = name.lowercase()
            try {
                return toDomain(deckRepository.saveAndFlush(entity))
            } catch (e: DataIntegrityViolationException) {
                throw DuplicateDeckNameException(name)
            }
        }
        val deck = fallbackDecks[deckId] ?: throw DeckNotFoundException(deckId)
        if (fallbackDecks.values.any { it.id != deckId && it.name.equals(name, ignoreCase = true) }) throw DuplicateDeckNameException(name)
        return deck.copy(name = name).also { fallbackDecks[deckId] = it }
    }

    @Synchronized
    @Transactional
    fun duplicateDeck(deckId: String, name: String): Deck {
        val original = getDeck(deckId) ?: throw DeckNotFoundException(deckId)
        val latest = getDeckVersions(deckId).lastOrNull()
        return createDeck(CreateDeckRequest(name, original.formatId, latest?.cards ?: emptyList()))
    }

    @Transactional(readOnly = true)
    fun exportDeck(deckId: String): String {
        getDeck(deckId) ?: throw DeckNotFoundException(deckId)
        return textExporter.export(getDeckVersions(deckId).lastOrNull()?.cards ?: emptyList())
    }

    @Transactional(readOnly = true)
    fun getDecks(): List<Deck> = if (deckRepository != null) {
        deckRepository.findAllByOrderByCreatedAtDesc().map { toDomain(it) }
    } else {
        fallbackDecks.values.toList().sortedByDescending { it.createdAt }
    }

    @Transactional(readOnly = true)
    fun getDeck(deckId: String): Deck? = if (deckRepository != null) {
        deckRepository.findById(deckId).map { toDomain(it) }.orElse(null)
    } else {
        fallbackDecks[deckId]
    }

    @Transactional
    fun deleteDeck(deckId: String): Boolean = if (deckRepository != null) {
        val exists = deckRepository.existsById(deckId)
        if (!exists) false else {
            deckVersionRepository?.deleteByDeck_Id(deckId)
            deckRepository.deleteById(deckId)
            true
        }
    } else {
        val removed = fallbackDecks.remove(deckId) != null
        if (removed) fallbackDeckVersions.remove(deckId)
        removed
    }

    @Synchronized
    @Transactional
    fun createDeck(request: CreateDeckRequest): Deck = if (deckRepository != null) {
        val name = request.name.trim()
        require(name.isNotEmpty()) { "Enter a deck name." }
        require(name.length <= 255) { "Deck names must be at most 255 characters." }
        val normalizedName = name.lowercase()
        if (deckRepository.existsByNormalizedName(normalizedName)) {
            throw DuplicateDeckNameException(name)
        }

        val createdAt = nowTrimmed()
        val deck = try {
            deckRepository.saveAndFlush(DeckEntity(
                id = UUID.randomUUID().toString(),
                name = name,
                formatId = request.formatId,
                createdAt = createdAt
            ))
        } catch (e: DataIntegrityViolationException) {
            throw DuplicateDeckNameException(name)
        }

        deckVersionRepository?.save(DeckVersionEntity(
            id = UUID.randomUUID().toString(),
            deck = deck,
            cardsJson = objectMapper.writeValueAsString(request.cards),
            notes = "Initial version",
            createdAt = createdAt
        ))

        toDomain(deck)
    } else {
        val name = request.name.trim()
        require(name.isNotEmpty()) { "Enter a deck name." }
        require(name.length <= 255) { "Deck names must be at most 255 characters." }
        if (fallbackDecks.values.any { it.name.equals(name, ignoreCase = true) }) {
            throw DuplicateDeckNameException(name)
        }

        val createdAt = nowTrimmed()
        val deck = Deck(
            id = UUID.randomUUID().toString(),
            name = name,
            formatId = request.formatId,
            createdAt = createdAt
        )
        fallbackDecks[deck.id] = deck
        fallbackDeckVersions[deck.id] = mutableListOf(DeckVersion(
            id = UUID.randomUUID().toString(),
            deckId = deck.id,
            cards = request.cards.toList(),
            notes = "Initial version",
            createdAt = createdAt
        ))
        deck
    }

    @Transactional
    fun addDeckVersion(deckId: String, request: AddDeckVersionRequest): DeckVersion = if (deckRepository != null) {
        val deck = deckRepository.findById(deckId).orElseThrow { IllegalArgumentException("Deck not found: $deckId") }
        val version = DeckVersionEntity(
            id = UUID.randomUUID().toString(),
            deck = deck,
            cardsJson = objectMapper.writeValueAsString(request.cards),
            notes = request.notes,
            createdAt = nowTrimmed()
        )
        val saved = deckVersionRepository!!.save(version)
        DeckVersion(
            id = saved.id,
            deckId = deck.id,
            cards = objectMapper.readValue(saved.cardsJson, Array<DeckCard>::class.java).toList(),
            notes = saved.notes,
            createdAt = saved.createdAt
        )
    } else {
        val deck = fallbackDecks[deckId] ?: throw IllegalArgumentException("Deck not found: $deckId")
        val version = DeckVersion(
            id = UUID.randomUUID().toString(),
            deckId = deck.id,
            cards = request.cards,
            notes = request.notes,
            createdAt = nowTrimmed()
        )
        fallbackDeckVersions.getOrPut(deck.id) { mutableListOf() }.add(version)
        version
    }

    @Transactional(readOnly = true)
    fun getDeckVersions(deckId: String): List<DeckVersion> = if (deckRepository != null) {
        deckVersionRepository!!.findByDeck_IdOrderByCreatedAtAsc(deckId).map { version ->
            DeckVersion(
                id = version.id,
                deckId = version.deck.id,
                cards = objectMapper.readValue(version.cardsJson, Array<DeckCard>::class.java).toList(),
                notes = version.notes,
                createdAt = version.createdAt
            )
        }
    } else {
        fallbackDeckVersions[deckId]?.toList() ?: emptyList()
    }

    @Transactional(readOnly = true)
    fun analyzeDeck(request: DeckAnalysisRequest): DeckAnalysisResult = if (deckRepository != null) {
        val deck = deckRepository.findById(request.deckId).orElseThrow { IllegalArgumentException("Deck not found: ${request.deckId}") }
        val format = formats.firstOrNull { it.id == request.formatId }
            ?: throw IllegalArgumentException("Format not found: ${request.formatId}")

        val latestVersion = deckVersionRepository!!.findByDeck_IdOrderByCreatedAtAsc(deck.id).lastOrNull()
            ?: throw IllegalArgumentException("Deck has no versions: ${deck.id}")

        val cards = objectMapper.readValue(latestVersion.cardsJson, Array<DeckCard>::class.java).toList()
        val cardCount = cards.sumOf { it.quantity }
        val uniqueCardCount = cards.map { it.cardId }.distinct().size
        val manaCurve = cards
            .filter { it.section == DeckSection.MAIN_DECK || it.section == DeckSection.CHAMPION }
            .mapNotNull { card -> getCard(card.cardId)?.cost?.let { Pair(it, card.quantity) } }
            .groupBy({ it.first.toString() }, { it.second })
            .mapValues { (_, values) -> values.sum() }

        val summary = buildString {
            append("${deck.name} is analyzed in ${format.name}. ")
            append("It contains $cardCount cards across $uniqueCardCount unique entries.")
        }

        DeckAnalysisResult(
            deckId = deck.id,
            formatId = format.id,
            cardCount = cardCount,
            uniqueCardCount = uniqueCardCount,
            manaCurve = manaCurve,
            summary = summary,
            warnings = emptyList()
        )
    } else {
        val deck = fallbackDecks[request.deckId] ?: throw IllegalArgumentException("Deck not found: ${request.deckId}")
        val format = formats.firstOrNull { it.id == request.formatId }
            ?: throw IllegalArgumentException("Format not found: ${request.formatId}")

        val latestVersion = fallbackDeckVersions[deck.id]?.lastOrNull()
            ?: throw IllegalArgumentException("Deck has no versions: ${deck.id}")

        val cardCount = latestVersion.cards.sumOf { it.quantity }
        val uniqueCardCount = latestVersion.cards.map { it.cardId }.distinct().size
        val manaCurve = latestVersion.cards
            .filter { it.section == DeckSection.MAIN_DECK || it.section == DeckSection.CHAMPION }
            .mapNotNull { card -> getCard(card.cardId)?.cost?.let { Pair(it, card.quantity) } }
            .groupBy({ it.first.toString() }, { it.second })
            .mapValues { (_, values) -> values.sum() }

        val summary = buildString {
            append("${deck.name} is analyzed in ${format.name}. ")
            append("It contains $cardCount cards across $uniqueCardCount unique entries.")
        }

        DeckAnalysisResult(
            deckId = deck.id,
            formatId = format.id,
            cardCount = cardCount,
            uniqueCardCount = uniqueCardCount,
            manaCurve = manaCurve,
            summary = summary,
            warnings = emptyList()
        )
    }

    private fun toDomain(entity: DeckEntity): Deck = Deck(
        id = entity.id,
        name = entity.name,
        formatId = entity.formatId,
        createdAt = entity.createdAt.truncatedTo(ChronoUnit.MILLIS)
    )

    private fun nowTrimmed(): Instant = Instant.now().truncatedTo(ChronoUnit.MILLIS)
}
