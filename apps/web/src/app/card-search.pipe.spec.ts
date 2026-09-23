import { CardSearchPipe } from './card-search.pipe';
import { Card } from './riftbound-api.service';

describe('CardSearchPipe', () => {
  const cards: Card[] = [
    { id: 'ogn-001-298', name: 'Blazing Scorcher', type: 'Unit', cost: 5,
      text: '[Accelerate]', setCode: 'OGN', domains: ['Fury'] },
    { id: 'other', name: 'Another card', type: 'Rune', cost: null,
      text: '', setCode: 'SFD', domains: ['Mind'] }
  ];
  const pipe = new CardSearchPipe();

  it('matches multiple terms across name, text, set and domain without case sensitivity', () => {
    expect(pipe.transform(cards, ' FURY accelerate ogn ')).toEqual([cards[0]]);
    expect(pipe.transform(cards, 'mind scorcher')).toEqual([]);
    expect(pipe.transform(cards, '  ')).toEqual([cards[1], cards[0]]);
  });

  const dual: Card = { id: 'dual', name: 'Zed', type: 'Legend', cost: null,
    text: 'Example', setCode: 'OGN', domains: ['Order', 'Chaos'] };
  const neutral: Card = { id: 'neutral', name: 'A Battlefield', type: 'Battlefield', cost: null,
    text: '', setCode: 'OGN', domains: [] };
  const colorless: Card = { id: 'colorless', name: 'Colorless Battlefield', type: 'Battlefield', cost: null,
    text: '', setCode: 'OGN', domains: ['Colorless'] };

  it('combines exact type and either domain with text search', () => {
    const catalog = [...cards, dual, neutral, colorless];
    expect(pipe.transform(catalog, 'example', 'Legend', 'Chaos')).toEqual([dual]);
    expect(pipe.transform(catalog, 'zed', 'legend', 'order')).toEqual([dual]);
    expect(pipe.transform(catalog, '', 'Unit', 'Mind')).toEqual([]);
    expect(pipe.transform(catalog, '', 'Rune', '')).toEqual([cards[1]]);
    expect(pipe.transform(catalog, '', 'Battlefield', 'Colorless')).toEqual([colorless]);
  });

  it('sorts names without mutating inputs and keeps Colorless distinct from missing domains', () => {
    const otherDual = { ...dual, id: 'dual-other', name: 'Akali', domains: ['Chaos', 'Order'] };
    const catalog = [neutral, dual, cards[1], cards[0], otherDual, colorless];
    const original = [...catalog];
    expect(pipe.transform(catalog, '').map(card => card.id))
      .toEqual(['neutral', 'dual-other', 'other', 'ogn-001-298', 'colorless', 'dual']);
    expect(catalog).toEqual(original);
    expect(dual.domains).toEqual(['Order', 'Chaos']);
    expect(pipe.transform([{ ...neutral, domains: undefined }], '', '', 'Colorless').length).toBe(0);
  });

  it('deduplicates only the filtered display and still finds alternate printing IDs and sets', () => {
    const alternate = { ...cards[0], id: 'ven-sp3-006', setCode: 'VEN' };
    const catalog = [cards[0], alternate];
    expect(pipe.transform(catalog, '')).toEqual([cards[0]]);
    expect(pipe.transform(catalog, 'ven-sp3-006')).toEqual([alternate]);
    expect(pipe.transform(catalog, 'VEN', 'Unit', 'Fury')).toEqual([alternate]);
    expect(catalog.length).toBe(2);
  });
});
