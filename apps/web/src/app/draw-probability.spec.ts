import { DrawFilters, MulliganPractice } from './mulligan-practice';
import { Card } from './riftbound-api.service';

describe('Conditional draw probabilities', () => {
  const card = (name: string, type: string, cost: number | null): Card => ({ id: name, name, type, cost, text: 'Unit scout ability 2', setCode: 'VEN' });
  const catalog = new Map([
    ['target', card('Scout Alpha', 'Unit', 2)],
    ['other', card('Something Else', 'Spell', 3)],
    ['unit3', card('Scout Beta', 'Unit', 3)],
    ['spell2', card('Scout Spell', 'Spell', 2)],
    ['zero', card('Zero', 'Unit', 0)],
    ['null', card('No Cost', 'Unit', null)],
  ]);
  const filters: DrawFilters = { name: 'scout alpha', type: 'Unit', cost: 2 };
  const make = (ids: string[]) => new MulliganPractice(ids.map(cardId => ({ cardId, quantity: 1 })), () => 0.999);
  const other = (n: number) => Array<string>(n).fill('other');

  it('ANDs partial names, exact types, and exact numeric costs; zero differs from unknown', () => {
    const session = make([...other(4), 'target', 'unit3', 'spell2', 'zero', 'null', ...other(30)]);
    expect(session.matchStatus({ ...filters, name: ' SCOUT ' }, catalog)?.inDeck).toBe(1);
    expect(session.matchStatus({ ...filters, name: '', type: 'unit' }, catalog)?.inDeck).toBe(1);
    expect(session.matchStatus({ name: '', type: 'Unit', cost: null }, catalog)?.inDeck).toBe(4);
    expect(session.matchStatus({ name: '', type: '', cost: 0 }, catalog)?.inDeck).toBe(1);
    expect(session.probabilityFor({ ...filters, name: '2abc' }, 1, catalog)?.percent).toBe(0);
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 / 35, 10);
  });

  it('matches exact no-replacement odds and updates after matching or nonmatching draws', () => {
    const session = make([...other(4), 'target', 'target', 'target', ...other(32)]);
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 * 3 / 35, 10);
    expect(session.probabilityFor(filters, 3, catalog)?.percent).toBeCloseTo(100 * (1 - (32 * 31 * 30) / (35 * 34 * 33)), 10);
    session.confirm(); session.draw();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 * 2 / 34, 10);
    const miss = make([...other(5), 'target', 'target', 'target', ...other(31)]);
    miss.confirm(); miss.draw();
    expect(miss.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 * 3 / 34, 10);
  });

  it('returns zero for all matches in hand, none in the catalog, zero draws left, and validates draw counts', () => {
    const session = make(['target', ...other(38)]);
    expect(session.probabilityFor(filters, 3, catalog)?.percent).toBe(0);
    expect(session.probabilityFor({ ...filters, name: 'missing' }, 3, catalog)?.percent).toBe(0);
    for (const count of [0, -1, NaN, Infinity, 1.5]) expect(session.probabilityFor(filters, count, catalog)).toBeNull();
    expect(session.probabilityFor({ name: '', type: '', cost: null }, 1, catalog)).toBeNull();
    session.confirm(); for (let i = 0; i < 35; i++) session.draw();
    expect(session.probabilityFor(filters, 3, catalog)).toEqual({ drawCount: 0, percent: 0 });
  });

  it('does not treat a known bottomed match as randomly drawable', () => {
    const session = make(['target', ...other(38)]);
    session.toggle(0); session.confirm();
    expect(session.matchStatus(filters, catalog)?.inDeck).toBe(1);
    expect(session.probabilityFor(filters, 34, catalog)?.percent).toBe(0);
    expect(session.probabilityFor(filters, 35, catalog)?.percent).toBe(100);
    expect(session.probabilityFor(filters, 100, catalog)).toEqual({ drawCount: 35, percent: 100 });
  });

  it('respects ordered bottom cards as the draw horizon crosses the known suffix', () => {
    const session = make(['target', ...other(38)]);
    session.toggle(1); session.toggle(0); session.confirm();
    expect(session.probabilityFor(filters, 34, catalog)?.percent).toBe(0);
    expect(session.probabilityFor(filters, 35, catalog)?.percent).toBe(100);
    for (let i = 0; i < 33; i++) session.draw();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBe(0);
    expect(session.probabilityFor(filters, 2, catalog)?.percent).toBe(100);
    session.draw();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBe(100);
    session.draw();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBe(0);
  });

  it('uses only the unknown composition after replacements and clears bottom knowledge on reset', () => {
    const session = make(['target', ...other(5), 'target', 'target', ...other(31)]);
    session.toggle(0); session.toggle(1); session.confirm();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 * 2 / 33, 10);
    session.reset();
    expect(session.probabilityFor(filters, 1, catalog)?.percent).toBeCloseTo(100 * 2 / 35, 10);
  });

  it('agrees with exhaustive two-card outcomes from a five-card unknown pile', () => {
    const remaining = ['target', 'other', 'target', 'other', 'other'];
    const session = make([...other(34), ...remaining]);
    session.confirm(); for (let i = 0; i < 30; i++) session.draw();
    let hits = 0; let total = 0;
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      total++;
      if (remaining[i] === 'target' || remaining[j] === 'target') hits++;
    }
    expect(session.probabilityFor(filters, 2, catalog)?.percent).toBeCloseTo(100 * hits / total, 10);
    expect(session.probabilityFor(filters, 4, catalog)?.percent).toBe(100);
  });

  it('does not peek at the unknown next card', () => {
    const first = make([...other(4), 'target', ...other(34)]);
    const last = make([...other(38), 'target']);
    expect(first.probabilityFor(filters, 1, catalog)).toEqual(last.probabilityFor(filters, 1, catalog));
  });
});
