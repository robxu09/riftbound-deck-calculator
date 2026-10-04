import { applySideboardSwaps, availableSwapCards } from './sideboard-lineup';
import { Card, DeckCard } from './riftbound-api.service';

export const lineupCards: Card[] = [
  { id: 'u', name: 'Unit', type: 'Unit', cost: 2, text: '', setCode: 'VEN' },
  { id: 's', name: 'Spell', type: 'Spell', cost: 3, text: '', setCode: 'VEN' },
  { id: 'r', name: 'Rune', type: 'Rune', cost: null, text: '', setCode: 'OGN' }
];
export const lineupEntries: DeckCard[] = [{ cardId: 'u', quantity: 39 }, { cardId: 's', quantity: 2, section: 'SIDEBOARD' }, { cardId: 'r', quantity: 12, section: 'RUNES' }];
const catalog = new Map(lineupCards.map(card => [card.id, card]));
const swap = { outCardId: 'u', inCardId: 's' };

describe('Sideboard lineup', () => {
  it('preserves all copy totals, 39 main cards and protected sections without mutating the saved list', () => {
    const before = JSON.stringify(lineupEntries);
    const result = applySideboardSwaps(lineupEntries, [swap, swap], catalog);
    expect(result.filter(e => e.section === 'MAIN_DECK').reduce((n, e) => n + e.quantity, 0)).toBe(39);
    expect(result.filter(e => e.section === 'SIDEBOARD').reduce((n, e) => n + e.quantity, 0)).toBe(2);
    for (const id of ['u', 's', 'r']) expect(result.filter(e => e.cardId === id).reduce((n, e) => n + e.quantity, 0)).toBe(lineupEntries.filter(e => e.cardId === id).reduce((n, e) => n + e.quantity, 0));
    expect(result.find(e => e.section === 'RUNES')).toEqual(lineupEntries[2]);
    expect(JSON.stringify(lineupEntries)).toBe(before);
    expect(availableSwapCards(lineupEntries, [swap, swap], 'SIDEBOARD')).toEqual([]);
    expect(availableSwapCards(lineupEntries, [swap], 'SIDEBOARD')[0].quantity).toBe(1);
  });
  it('rejects excess, chained, identical, unknown and protected-card swaps', () => {
    for (const swaps of [[swap, swap, swap], [swap, { outCardId: 's', inCardId: 'u' }], [{ outCardId: 'u', inCardId: 'u' }], [{ outCardId: 'r', inCardId: 's' }], [{ outCardId: 'u', inCardId: 'missing' }]]) {
      expect(() => applySideboardSwaps(lineupEntries, swaps, catalog)).toThrow();
    }
    expect(() => applySideboardSwaps([], [swap], catalog)).toThrow();
  });
  it('aggregates duplicate entries and supports cards present in both sections', () => {
    const entries: DeckCard[] = [{ cardId: 'u', quantity: 1 }, { cardId: 'u', quantity: 37 }, { cardId: 's', quantity: 1 }, { cardId: 'u', quantity: 1, section: 'SIDEBOARD' }, { cardId: 's', quantity: 1, section: 'SIDEBOARD' }];
    expect(availableSwapCards(entries, [], 'MAIN_DECK').find(e => e.cardId === 'u')?.quantity).toBe(38);
    const result = applySideboardSwaps(entries, [swap], catalog);
    expect(result.filter(e => e.cardId === 'u' && e.section === 'MAIN_DECK').reduce((n, e) => n + e.quantity, 0)).toBe(37);
  });
});
