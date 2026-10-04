import { matchesOpeningCard, OpeningFilters, openingHandOdds } from './opening-hand-odds';
import { Card, DeckCard } from './riftbound-api.service';

const unit: Card = { id: 'u', name: 'Scout Alpha', type: 'Unit', cost: 2, text: '', setCode: 'VEN' };
const catalog = new Map([['u', unit], ['s', { ...unit, id: 's', type: 'Spell' }]]);
const filters: OpeningFilters = { name: '', type: 'Unit', cost: null, comparison: 'exact' };
const entries: DeckCard[] = [{ cardId: 'u', quantity: 7 }, { cardId: 's', quantity: 32 }];

describe('Opening hand odds', () => {
  it('calculates keyword-only odds and combines the keyword with name, type and cost', () => {
    const hidden = { ...unit, text: '[Hidden] (Hide now.)' };
    const mentioning = { ...unit, id: 's', name: 'Hidden supporter', text: 'Play a card with [Hidden] from your hand.' };
    const keywordCatalog = new Map([['u', hidden], ['s', mentioning]]);
    const query: OpeningFilters = { name: '', keyword: ' hIdDeN ', type: '', cost: null, comparison: 'exact' };
    const result = openingHandOdds(entries, keywordCatalog, query, 1);
    expect(result.matches).toBe(7);
    expect(result.percent).toBeCloseTo(100 * (1 - (32 * 31 * 30 * 29) / (39 * 38 * 37 * 36)), 10);
    expect(openingHandOdds(entries, keywordCatalog, { ...query, name: 'scout', type: 'Unit', cost: 2 }, 1)).toEqual(result);
    expect(openingHandOdds(entries, keywordCatalog, { ...query, type: 'Spell' }, 1).percent).toBe(0);
    expect(openingHandOdds(entries, keywordCatalog, { ...query, cost: 3 }, 1).percent).toBe(0);
    expect(openingHandOdds(entries, keywordCatalog, { ...query, keyword: 'missing' }, 1).percent).toBe(0);
    expect(openingHandOdds(entries, keywordCatalog, { ...query, keyword: '   ' }, 1).percent).toBeNull();
  });

  it('agrees with every possible opening four for all matching thresholds', () => {
    const successes = [0, 0, 0, 0];
    let total = 0;
    for (let a = 0; a < 36; a++) for (let b = a + 1; b < 37; b++)
      for (let c = b + 1; c < 38; c++) for (let d = c + 1; d < 39; d++) {
        const matches = [a, b, c, d].filter(i => i < 7).length;
        total++;
        for (let threshold = 1; threshold <= 4; threshold++) if (matches >= threshold) successes[threshold - 1]++;
      }
    for (let threshold = 1; threshold <= 4; threshold++) {
      expect(openingHandOdds(entries, catalog, filters, threshold).percent).toBeCloseTo(100 * successes[threshold - 1] / total, 10);
    }
  });

  it('combines case-insensitive name words, type and cost comparisons without treating unknown as zero', () => {
    const query = { ...filters, name: ' ALPHA scout ', cost: 2 };
    expect(matchesOpeningCard(unit, query)).toBeTrue();
    expect(matchesOpeningCard({ ...unit, type: 'Spell' }, query)).toBeFalse();
    expect(matchesOpeningCard(unit, { ...query, name: 'missing' })).toBeFalse();
    expect(matchesOpeningCard(unit, { ...query, cost: 3, comparison: 'atMost' })).toBeTrue();
    expect(matchesOpeningCard(unit, { ...query, cost: 3, comparison: 'atLeast' })).toBeFalse();
    expect(matchesOpeningCard(unit, { ...query, comparison: 'atLeast' })).toBeTrue();
    expect(matchesOpeningCard({ ...unit, cost: 0 }, { ...query, cost: 0 })).toBeTrue();
    expect(matchesOpeningCard({ ...unit, cost: null }, { ...query, cost: 0, comparison: 'atMost' })).toBeFalse();
    expect(matchesOpeningCard({ ...unit, cost: null }, filters)).toBeTrue();
  });

  it('counts copies and ignores every section outside the Main Deck', () => {
    const excluded: DeckCard[] = ['CHAMPION', 'LEGEND', 'RUNES', 'BATTLEFIELDS', 'SIDEBOARD'].map(section => ({ cardId: 'u', quantity: 12, section: section as DeckCard['section'] }));
    expect(openingHandOdds([...entries, ...excluded], catalog, filters, 1)).toEqual(openingHandOdds(entries, catalog, filters, 1));
    expect(openingHandOdds(entries, catalog, filters, 1).matches).toBe(7);
  });

  it('handles zero, guaranteed and impossible matches', () => {
    expect(openingHandOdds(entries, catalog, { ...filters, name: 'absent' }, 1).percent).toBe(0);
    expect(openingHandOdds([{ cardId: 'u', quantity: 39 }], catalog, filters, 4).percent).toBe(100);
    expect(openingHandOdds([{ cardId: 'u', quantity: 1 }, { cardId: 's', quantity: 38 }], catalog, filters, 2).percent).toBe(0);
  });

  it('rejects incomplete decks, missing cards, invalid inputs and empty filters', () => {
    expect(openingHandOdds([], catalog, filters, 1).percent).toBeNull();
    expect(openingHandOdds(entries, new Map(), filters, 1).percent).toBeNull();
    for (const minimum of [0, 5, 1.5, NaN]) expect(openingHandOdds(entries, catalog, filters, minimum).percent).toBeNull();
    for (const cost of [-1, 1.5, NaN]) expect(openingHandOdds(entries, catalog, { ...filters, cost }, 1).percent).toBeNull();
    expect(openingHandOdds(entries, catalog, { ...filters, type: '' }, 1).percent).toBeNull();
  });
});
