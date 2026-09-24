import { MulliganPractice } from './mulligan-practice';
import { DeckCard } from './riftbound-api.service';

describe('MulliganPractice', () => {
  const entries: DeckCard[] = Array.from({ length: 39 }, (_, i) => ({ cardId: `card-${i}`, quantity: 1, section: 'MAIN_DECK' }));
  const unchangedShuffle = () => 0.999;

  it('deals four individual copies using only Main Deck cards', () => {
    const session = new MulliganPractice([
      { cardId: 'copies', quantity: 39 },
      ...(['CHAMPION', 'LEGEND', 'RUNES', 'BATTLEFIELDS', 'SIDEBOARD'] as const)
        .map(section => ({ cardId: section, quantity: 12, section }))
    ], unchangedShuffle);
    expect(session.hand.map(card => card.cardId)).toEqual(Array(4).fill('copies'));
    expect(new Set(session.hand.map(card => card.copyId)).size).toBe(4);
    expect(session.remaining).toBe(35);
  });

  it('limits selection to two distinct copies and permits deselection', () => {
    const session = new MulliganPractice(entries, unchangedShuffle);
    session.toggle(0); session.toggle(1); session.toggle(2); session.toggle(999);
    expect(session.selected).toEqual([0, 1]);
    session.toggle(0); session.toggle(2);
    expect(session.selected).toEqual([1, 2]);
    session.draw();
    expect(session.hand.length).toBe(4);
    expect(session.remaining).toBe(35);
  });

  it('resets selections and reshuffles from the full original deck without mutating it', () => {
    const original = JSON.stringify(entries);
    let value = 0.999;
    const session = new MulliganPractice(entries, () => value);
    const first = session.hand.map(card => card.cardId);
    session.toggle(0);
    value = 0;
    session.reset();
    expect(session.hand.map(card => card.cardId)).not.toEqual(first);
    expect(session.hand.length).toBe(4);
    expect(session.remaining).toBe(35);
    expect(session.selected).toEqual([]);
    expect(session.draws).toEqual([]);
    expect(session.choosing).toBeTrue();
    expect(JSON.stringify(entries)).toBe(original);
  });

  it('rejects invalid quantities and Main Deck sizes without counting other sections', () => {
    expect(() => new MulliganPractice(entries.slice(1))).toThrowError(/39 Main Deck cards/);
    expect(() => new MulliganPractice([{ cardId: 'x', quantity: 39, section: 'SIDEBOARD' }])).toThrowError(/39 Main Deck cards/);
    expect(() => new MulliganPractice([{ cardId: 'x', quantity: 38.5 }, { cardId: 'y', quantity: 0.5 }])).toThrowError(/39 Main Deck cards/);
  });

  it('replaces zero, one or two cards immediately and allows only one mulligan', () => {
    for (const count of [0, 1, 2]) {
      const session = new MulliganPractice(entries, unchangedShuffle);
      for (let i = 0; i < count; i++) session.toggle(i);
      session.confirm();
      expect(session.hand.length).toBe(4);
      expect(session.remaining).toBe(35);
      expect(session.choosing).toBeFalse();
      expect(session.draws).toEqual([]);
      expect(session.hand.map(card => card.copyId)).toEqual([0, 1, 2, 3, 4, 5].slice(count, count + 4));
      const hand = [...session.hand];
      session.toggle(session.hand[0].copyId);
      session.confirm();
      expect(session.hand).toEqual(hand);
      expect(session.selected).toEqual([]);
    }
  });

  it('keeps bottomed copies at the end in selection order and draws without replacement', () => {
    const session = new MulliganPractice(entries, unchangedShuffle);
    session.toggle(1); session.toggle(0); session.confirm();
    for (let i = 0; i < 35; i++) session.draw();
    expect(session.draws.slice(-2).map(card => card.copyId)).toEqual([1, 0]);
    expect(session.remaining).toBe(0);
    expect(session.hand.length).toBe(39);
    expect(new Set(session.hand.map(card => card.copyId)).size).toBe(39);
    session.draw();
    expect(session.draws.length).toBe(35);
    session.reset();
    expect(session.hand.length).toBe(4);
    expect(session.remaining).toBe(35);
    expect(session.draws).toEqual([]);
    expect(session.choosing).toBeTrue();
  });
});
