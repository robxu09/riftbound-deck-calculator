import { RunePractice } from './rune-practice';
import { Card, DeckCard } from './riftbound-api.service';

const rune = (id: string): Card => ({ id, name: id, type: 'Rune', cost: null, text: '', setCode: 'OGN' });
const catalog = new Map([['body', rune('body')], ['order', rune('order')]]);
const entries: DeckCard[] = [{ cardId: 'body', quantity: 6, section: 'RUNES' }, { cardId: 'order', quantity: 6, section: 'RUNES' }];

describe('RunePractice', () => {
  it('channels individual copies from a separate rune pile and groups matching runes in play', () => {
    const session = new RunePractice([...entries, { cardId: 'ignored', quantity: 39 }], catalog, () => 0.999);
    expect(session.remaining).toBe(12); expect(session.inPlay).toEqual([]);
    session.channel(); session.channel();
    expect(session.inPlay.map(c => c.copyId)).toEqual([0, 1]);
    expect(session.groups).toEqual([{ cardId: 'body', copyId: 0, quantity: 2 }]);
    expect(session.remaining).toBe(10);
  });
  it('recycles to the bottom in action order without duplicating, losing or reshuffling copies', () => {
    const session = new RunePractice(entries, catalog, () => 0.999);
    session.channel(); session.channel();
    session.recycle(1); session.recycle(0); session.recycle(0); session.recycle(999);
    expect(session.remaining).toBe(12); expect(session.inPlay).toEqual([]);
    for (let i = 0; i < 12; i++) session.channel();
    expect(session.inPlay.map(c => c.copyId)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 0]);
    session.channel(); expect(session.inPlay.length).toBe(12); expect(session.remaining).toBe(0);
    expect(new Set(session.inPlay.map(c => c.copyId)).size).toBe(12);
    session.recycle(5); session.channel(); expect(session.inPlay.at(-1)?.copyId).toBe(5);
  });
  it('reshuffles all runes on reset and never modifies the saved deck', () => {
    const original = JSON.stringify(entries);
    let random = 0.999;
    const session = new RunePractice(entries, catalog, () => random);
    session.channel(); const first = session.inPlay[0];
    random = 0; session.reset(); expect(session.inPlay).toEqual([]); expect(session.remaining).toBe(12);
    session.channel(); expect(session.inPlay[0]).not.toEqual(first);
    expect(JSON.stringify(entries)).toBe(original);
  });
  it('handles missing and incomplete rune decks without inventing runes, and rejects invalid entries', () => {
    const empty = new RunePractice([], catalog); empty.channel(); empty.recycle(0);
    expect(empty.total).toBe(0); expect(empty.inPlay).toEqual([]);
    expect(new RunePractice([{ ...entries[0], quantity: 1 }], catalog).total).toBe(1);
    for (const quantity of [0, -1, 1.5, NaN]) expect(() => new RunePractice([{ ...entries[0], quantity }], catalog)).toThrow();
    expect(() => new RunePractice(entries, new Map())).toThrowError(/missing/);
    expect(() => new RunePractice(entries, new Map([['body', { ...rune('body'), type: 'Unit' }], ['order', rune('order')]]))).toThrowError(/non-rune/);
  });
});
