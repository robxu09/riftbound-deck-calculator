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
    expect(pipe.transform(cards, '  ')).toEqual(cards);
  });
});
