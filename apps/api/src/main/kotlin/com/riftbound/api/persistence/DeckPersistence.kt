package com.riftbound.api.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "decks")
class DeckEntity {
    @Id
    var id: String = UUID.randomUUID().toString()

    @Column(nullable = false)
    var name: String = ""

    @Column(name = "normalized_name", nullable = false, unique = true)
    var normalizedName: String = ""

    @Column(nullable = false)
    var formatId: String = ""

    @Column(nullable = false)
    var createdAt: Instant = Instant.now()

    @PrePersist
    fun normalizeName() {
        normalizedName = name.trim().lowercase()
    }

    constructor()

    constructor(id: String, name: String, formatId: String, createdAt: Instant = Instant.now()) {
        this.id = id
        this.name = name
        this.formatId = formatId
        this.createdAt = createdAt
        this.normalizedName = name.trim().lowercase()
    }
}

@Entity
@Table(name = "deck_versions")
class DeckVersionEntity {
    @Id
    var id: String = UUID.randomUUID().toString()

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "deck_id", nullable = false)
    lateinit var deck: DeckEntity

    @Column(columnDefinition = "TEXT", nullable = false)
    var cardsJson: String = "[]"

    var notes: String? = null

    @Column(nullable = false)
    var createdAt: Instant = Instant.now()

    constructor()

    constructor(id: String, deck: DeckEntity, cardsJson: String, notes: String? = null, createdAt: Instant = Instant.now()) {
        this.id = id
        this.deck = deck
        this.cardsJson = cardsJson
        this.notes = notes
        this.createdAt = createdAt
    }
}

@Repository
interface DeckRepository : JpaRepository<DeckEntity, String> {
    fun existsByNameIgnoreCase(name: String): Boolean
    fun existsByNormalizedName(normalizedName: String): Boolean
    fun findAllByOrderByCreatedAtDesc(): List<DeckEntity>
}

@Repository
interface DeckVersionRepository : JpaRepository<DeckVersionEntity, String> {
    fun findByDeck_IdOrderByCreatedAtAsc(deckId: String): List<DeckVersionEntity>
    fun deleteByDeck_Id(deckId: String)
}
