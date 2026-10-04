package com.riftbound.api.domain

data class SideboardSwap(val outCardId: String, val inCardId: String)
data class SideboardPlan(val id: String, val name: String, val baseVersionId: String, val swaps: List<SideboardSwap>)
data class SaveSideboardPlanRequest(val name: String, val baseVersionId: String, val swaps: List<SideboardSwap>)

/** A plan consumes copies from the original main deck and sideboard, never chained swaps. */
fun validateSideboardSwaps(entries: List<DeckCard>, swaps: List<SideboardSwap>, catalog: Map<String, Card>) {
    val main = entries.filter { it.section == DeckSection.MAIN_DECK }
    val side = entries.filter { it.section == DeckSection.SIDEBOARD }
    require((main + side).all { it.quantity > 0 }) { "Invalid card quantities." }
    require(main.sumOf { it.quantity.toLong() } == 39L) { "Requires 39 Main Deck cards." }
    require(swaps.size in 1..39) { "Choose between 1 and 39 swaps." }
    val outgoing = main.groupBy { it.cardId }.mapValues { (_, cards) -> cards.sumOf { it.quantity.toLong() } }.toMutableMap()
    val incoming = side.groupBy { it.cardId }.mapValues { (_, cards) -> cards.sumOf { it.quantity.toLong() } }.toMutableMap()
    swaps.forEach { swap ->
        require(swap.outCardId != swap.inCardId) { "Choose different cards to swap." }
        require(listOf(swap.outCardId, swap.inCardId).all { catalog[it]?.type?.lowercase() in listOf("unit", "spell") }) {
            "Only units and spells can be swapped."
        }
        require(outgoing.getOrDefault(swap.outCardId, 0) > 0 && incoming.getOrDefault(swap.inCardId, 0) > 0) {
            "A swap exceeds the available copies in the saved lineup."
        }
        outgoing[swap.outCardId] = outgoing.getValue(swap.outCardId) - 1
        incoming[swap.inCardId] = incoming.getValue(swap.inCardId) - 1
    }
}
