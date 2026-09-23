import { Pipe, PipeTransform } from '@angular/core';
import { Card } from './riftbound-api.service';

@Pipe({ name: 'cardSearch', standalone: true })
export class CardSearchPipe implements PipeTransform {
  transform(cards: Card[], query: string): Card[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cards.filter(card => {
      const searchable = [card.name, card.id, card.type, card.supertype, card.text,
        card.setCode, ...(card.domains ?? [])].join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }
}
