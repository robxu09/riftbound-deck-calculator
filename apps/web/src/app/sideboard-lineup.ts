import { Card, DeckCard, SideboardSwap } from './riftbound-api.service';

/** Remaining choices from the saved lineup; returned cards cannot be swapped again. */
export function availableSwapCards(entries: DeckCard[], swaps: SideboardSwap[], section: 'MAIN_DECK' | 'SIDEBOARD'): DeckCard[] {
  const counts = new Map<string, number>();
  for (const entry of entries) if ((entry.section ?? 'MAIN_DECK') === section) counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + entry.quantity);
  for (const swap of swaps) {
    const id = section === 'MAIN_DECK' ? swap.outCardId : swap.inCardId;
    counts.set(id, (counts.get(id) ?? 0) - 1);
  }
  return [...counts].filter(([, quantity]) => quantity > 0).map(([cardId, quantity]) => ({ cardId, quantity, section }));
}

/** Creates a temporary lineup without modifying the saved entries. */
export function applySideboardSwaps(entries: DeckCard[], swaps: SideboardSwap[], catalog: ReadonlyMap<string, Card>): DeckCard[] {
  const main = entries.filter(entry => (entry.section ?? 'MAIN_DECK') === 'MAIN_DECK');
  const side = entries.filter(entry => entry.section === 'SIDEBOARD');
  if ([...main, ...side].some(entry => !Number.isInteger(entry.quantity) || entry.quantity < 1) || main.reduce((sum, entry) => sum + entry.quantity, 0) !== 39) throw new Error('Requires 39 Main Deck cards and valid quantities.');
  const processed: SideboardSwap[] = [];
  for (const swap of swaps) {
    if (swap.outCardId === swap.inCardId) throw new Error('Choose different cards to swap.');
    if (![swap.outCardId, swap.inCardId].every(id => ['unit', 'spell'].includes(catalog.get(id)?.type.toLowerCase() ?? ''))) throw new Error('Only units and spells can be swapped.');
    if (!availableSwapCards(entries, processed, 'MAIN_DECK').some(card => card.cardId === swap.outCardId) ||
        !availableSwapCards(entries, processed, 'SIDEBOARD').some(card => card.cardId === swap.inCardId)) throw new Error('A swap exceeds the available copies in the saved lineup.');
    processed.push(swap);
  }
  const adjusted = entries.map(entry => ({ ...entry, section: entry.section ?? 'MAIN_DECK' }));
  const move = (id: string, from: 'MAIN_DECK' | 'SIDEBOARD', to: 'MAIN_DECK' | 'SIDEBOARD') => {
    adjusted.find(entry => entry.cardId === id && entry.section === from && entry.quantity > 0)!.quantity--;
    const target = adjusted.find(entry => entry.cardId === id && entry.section === to);
    if (target) target.quantity++; else adjusted.push({ cardId: id, quantity: 1, section: to });
  };
  for (const swap of swaps) {
    move(swap.outCardId, 'MAIN_DECK', 'SIDEBOARD');
    move(swap.inCardId, 'SIDEBOARD', 'MAIN_DECK');
  }
  return adjusted.filter(entry => entry.quantity > 0);
}
