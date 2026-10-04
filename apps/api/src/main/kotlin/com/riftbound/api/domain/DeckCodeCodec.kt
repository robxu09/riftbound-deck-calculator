package com.riftbound.api.domain

import java.io.ByteArrayOutputStream

/**
 * Piltover Archive's public deck-code wire format, versions 1–6.
 * Framework/catalog independent. See docs/deck-codes.md for the specification
 * and reference-library interoperability fixtures. Limits are input safeguards,
 * not game rules. No unrecognized data is silently discarded.
 */
object DeckCodeCodec {
    data class Entry(val cardCode: String, val count: Int)
    data class DeckCode(
        val mainDeck: List<Entry>, val sideboard: List<Entry> = emptyList(),
        val chosenChampion: String? = null, val additionalLegends: List<String> = emptyList()
    )

    private val sets = listOf("OGN", "OGS", "ARC", "SFD", "UNL", "VEN", "RAD")
    private val variants = listOf("", "a", "s", "b")
    private const val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    private const val maxQuantity = 1_000_000
    private data class Ref(val set: Int, val variant: Int, val prefix: Int, val number: Int) {
        fun code(): String = sets[set] + "-" + when (prefix) {
            0 -> number.toString().padStart(3, '0')
            1 -> "R" + number.toString().padStart(2, '0')
            else -> "SP$number"
        } + variants[variant]
    }

    private fun ref(code: String): Ref {
        val match = Regex("([A-Z]{3})-(R|SP)?(\\d+)([asb*]?)").matchEntire(code)
        requireNotNull(match) { "Unsupported card code: $code. Use text export for this card." }
        val set = sets.indexOf(match.groupValues[1])
        require(set >= 0) { "Unsupported card set: ${match.groupValues[1]}." }
        val variant = variants.indexOf(match.groupValues[4].replace("*", "s"))
        val number = match.groupValues[3].toIntOrNull()
        require(number != null && number in 0..maxQuantity) { "Invalid card number: $code." }
        return Ref(set, variant, listOf("", "R", "SP").indexOf(match.groupValues[2]), number)
    }

    fun decode(input: String): DeckCode {
        require(input.length <= 100_000) { "Deck code must be at most 100,000 characters." }
        val code = input.replace(Regex("\\s+"), "").uppercase()
        require(code.isNotEmpty()) { "Paste a deck code." }
        val bytes = ByteArrayOutputStream()
        var buffer = 0
        var bits = 0
        code.forEach { char ->
            val value = alphabet.indexOf(char)
            require(value >= 0) { "Invalid character in deck code: '$char'." }
            buffer = (buffer shl 5) or value
            bits += 5
            if (bits >= 8) {
                bits -= 8
                bytes.write((buffer ushr bits) and 255)
            }
        }
        val data = bytes.toByteArray()
        require(base32(data) == code) { "Invalid or truncated deck code." }
        val reader = Reader(data)
        val header = reader.byte()
        require(header ushr 4 == 1) { "Unsupported deck-code format." }
        val version = header and 15
        require(version in 1..6) { "Unsupported deck-code version: $version." }
        val flagged = if (version >= 5) reader.flag() else version == 4

        fun section(maxCount: Int): List<Entry> {
            val result = mutableListOf<Entry>()
            val numCounts = if (version >= 5) reader.length() else maxCount
            repeat(numCounts) { index ->
                val count = if (version >= 5) reader.varint() else maxCount - index
                require(count in 1..maxQuantity) { "Invalid or excessive card quantity in deck code." }
                repeat(reader.length()) {
                    val numCards = reader.length()
                    val set = reader.byte()
                    val variant = reader.byte()
                    reader.validateGroup(set, variant)
                    repeat(numCards) {
                        result.add(Entry(reader.card(set, variant, flagged, version).code(), count))
                    }
                }
            }
            return result
        }

        val main = section(12)
        val side = if (version >= 2) section(3) else emptyList()
        val champion = if (version >= 3 && reader.flag()) reader.cardRef(flagged, version).code() else null
        val legends = if (version >= 6) List(reader.length()) { reader.cardRef(flagged, version).code() } else emptyList()
        require(reader.remaining == 0) { "Unexpected trailing data in deck code." }
        return DeckCode(main, side, champion, legends)
    }

    fun encode(deck: DeckCode): String {
        fun merge(entries: List<Entry>): Map<Ref, Int> {
            val merged = linkedMapOf<Ref, Int>()
            entries.forEach {
                val card = ref(it.cardCode)
                require(it.count in 1..maxQuantity) { "Invalid quantity for ${it.cardCode}." }
                val count = (merged[card] ?: 0).toLong() + it.count
                require(count <= maxQuantity) { "Quantity is too large for ${it.cardCode}." }
                merged[card] = count.toInt()
            }
            return merged
        }
        val main = merge(deck.mainDeck)
        val side = merge(deck.sideboard)
        val champion = deck.chosenChampion?.let(::ref)
        val legends = deck.additionalLegends.map(::ref)
        val refs = main.keys + side.keys + listOfNotNull(champion) + legends
        val flagged = refs.any { it.prefix != 0 }
        val version = when {
            legends.isNotEmpty() -> 6
            refs.any { it.prefix == 2 } || main.values.any { it > 12 } || side.values.any { it > 3 } -> 5
            flagged -> 4
            else -> 3
        }
        val bytes = ByteArrayOutputStream()
        fun varint(value: Int) {
            var rest = value
            do {
                val next = rest and 127
                rest = rest ushr 7
                bytes.write(next or if (rest > 0) 128 else 0)
            } while (rest > 0)
        }
        fun number(card: Ref) {
            if (flagged) bytes.write(card.prefix)
            varint(card.number)
        }
        fun cardRef(card: Ref) {
            bytes.write(card.set)
            bytes.write(card.variant)
            number(card)
        }
        fun section(entries: Map<Ref, Int>, maxCount: Int) {
            val counts = if (version >= 5) entries.values.distinct().sortedDescending() else (maxCount downTo 1).toList()
            if (version >= 5) varint(counts.size)
            counts.forEach { count ->
                if (version >= 5) varint(count)
                val groups = entries.filterValues { it == count }.keys.groupBy { it.set to it.variant }
                    .toSortedMap(compareBy<Pair<Int, Int>> { it.first }.thenBy { it.second })
                varint(groups.size)
                groups.forEach { (group, cards) ->
                    varint(cards.size)
                    bytes.write(group.first)
                    bytes.write(group.second)
                    cards.sortedWith(compareBy<Ref> { it.prefix }.thenBy { it.number }).forEach(::number)
                }
            }
        }
        bytes.write(16 or version)
        if (version >= 5) bytes.write(if (flagged) 1 else 0)
        section(main, 12)
        section(side, 3)
        bytes.write(if (champion != null) 1 else 0)
        champion?.let(::cardRef)
        if (version >= 6) {
            varint(legends.size)
            legends.forEach(::cardRef)
        }
        return base32(bytes.toByteArray()).also {
            require(it.length <= 100_000) { "Deck exceeds the deck-code size limit." }
        }
    }

    private fun base32(bytes: ByteArray): String = buildString {
        var buffer = 0
        var bits = 0
        bytes.forEach {
            buffer = (buffer shl 8) or (it.toInt() and 255)
            bits += 8
            while (bits >= 5) {
                bits -= 5
                append(alphabet[(buffer ushr bits) and 31])
            }
        }
        if (bits > 0) append(alphabet[(buffer shl (5 - bits)) and 31])
    }

    private class Reader(private val data: ByteArray) {
        private var position = 0
        val remaining get() = data.size - position
        fun byte(): Int {
            require(remaining > 0) { "Truncated deck code." }
            return data[position++].toInt() and 255
        }
        fun flag(): Boolean {
            val value = byte()
            require(value in 0..1) { "Unsupported flag in deck code." }
            return value == 1
        }
        fun varint(): Int {
            var value = 0L
            for (shift in 0..28 step 7) {
                val next = byte()
                value = value or ((next and 127).toLong() shl shift)
                require(value <= Int.MAX_VALUE) { "Number is too large in deck code." }
                if (next and 128 == 0) return value.toInt()
            }
            throw IllegalArgumentException("Invalid number in deck code.")
        }
        fun length(): Int = varint().also {
            require(it <= remaining) { "Invalid length or truncated deck code." }
        }
        fun validateGroup(set: Int, variant: Int) {
            require(set in sets.indices) { "Unsupported set identifier in deck code: $set." }
            require(variant in variants.indices) { "Unsupported printing variant in deck code: $variant." }
        }
        fun card(set: Int, variant: Int, flagged: Boolean, version: Int): Ref {
            val prefix = if (flagged) byte() else 0
            require(prefix in 0..(if (version >= 5) 2 else 1)) { "Unsupported card-number prefix in deck code." }
            val number = varint()
            require(number <= maxQuantity) { "Card number is too large in deck code." }
            return Ref(set, variant, prefix, number)
        }
        fun cardRef(flagged: Boolean, version: Int): Ref {
            val set = byte()
            val variant = byte()
            validateGroup(set, variant)
            return card(set, variant, flagged, version)
        }
    }
}
