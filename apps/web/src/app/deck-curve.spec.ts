import { buildDeckCurve } from './deck-curve';
import { Card, DeckCard } from './riftbound-api.service';

const card = (id: string, type: string, cost: number | null, power?: number | null): Card =>
  ({ id, name: id, type, cost, power, text: '', setCode: 'OGN' });
const catalog = [card('unit', 'Unit', 2, 1), card('spell', 'Spell', 2, 0), card('zero', 'Unit', 0, null), card('large', 'Unit', 10, 3)];

describe('Deck curves', () => {
  it('counts copies by type at each cost and sorts costs numerically', () => {
    const entries = [{ cardId: 'large', quantity: 1 }, { cardId: 'unit', quantity: 3 }, { cardId: 'spell', quantity: 2 }, { cardId: 'zero', quantity: 1 }];
    const result = buildDeckCurve(entries, catalog, 'cost', 'main');
    expect(result.rows.map(row => row.value)).toEqual([0, 2, 10]);
    expect(result.rows[1]).toEqual({ value: 2, total: 5, counts: { Unit: 3, Spell: 2 } });
    expect(result.total).toBe(7);
    expect(result.max).toBe(5);
  });

  it('separates main, champion and sideboard and excludes other sections', () => {
    const sections: DeckCard['section'][] = ['MAIN_DECK', 'CHAMPION', 'SIDEBOARD', 'LEGEND', 'RUNES', 'BATTLEFIELDS'];
    const entries = sections.map((section, i) => ({ cardId: 'unit', quantity: i + 1, section }));
    expect(buildDeckCurve(entries, catalog, 'cost', 'mainChampion').total).toBe(3);
    expect(buildDeckCurve(entries, catalog, 'cost', 'main').total).toBe(1);
    expect(buildDeckCurve(entries, catalog, 'cost', 'sideboard').total).toBe(3);
  });

  it('uses Power independently of Energy and Might, preserving zero', () => {
    const result = buildDeckCurve([{ cardId: 'unit', quantity: 2 }, { cardId: 'spell', quantity: 3 }],
      catalog.map(c => ({ ...c, might: 9 })), 'power', 'main');
    expect(result.rows.map(row => [row.value, row.total])).toEqual([[0, 3], [1, 2]]);
  });

  it('reports missing data without turning it into zero', () => {
    const entries = [{ cardId: 'zero', quantity: 2 }, { cardId: 'unknown', quantity: 3 }];
    const result = buildDeckCurve(entries, catalog, 'power', 'main');
    expect(result.missing).toBe(5);
    expect(result.total).toBe(5);
    expect(result.rows).toEqual([]);
    expect(buildDeckCurve([{ cardId: 'null', quantity: 1 }], [card('null', 'Unit', null)], 'cost', 'main').missing).toBe(1);
  });

  it('handles empty drafts', () => {
    expect(buildDeckCurve([], catalog, 'cost', 'main')).toEqual({ rows: [], types: [], total: 0, missing: 0, max: 1 });
  });
});
