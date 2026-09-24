import { Pipe, PipeTransform } from '@angular/core';
import { Card } from './riftbound-api.service';

@Pipe({ name: 'cardSearch', standalone: true })
export class CardSearchPipe implements PipeTransform {
  transform(cards: Card[], query: string, type = '', domain = '', set = '', cost: number | null = null): Card[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const displayedNames = new Set<string>();
    return cards.filter(card => {
      if (cost !== null && card.cost !== cost) return false;
      if (set && card.setCode.trim().toUpperCase() !== set.trim().toUpperCase()) return false;
      if (type && card.type.toLowerCase() !== type.toLowerCase()) return false;
      if (domain) {
        const normalizedDomain = domain.toLowerCase();
        const matchesDomain = card.domains?.some(value => value.toLowerCase() === normalizedDomain);
        if (!matchesDomain) return false;
      }
      const searchable = [card.name, card.id, card.type, card.supertype, card.text,
        card.setCode, ...(card.domains ?? [])].join(' ').toLowerCase();
      if (!terms.every(term => searchable.includes(term))) return false;
      // Collapse printings only for display, after searching all IDs and sets.
      const name = card.name.trim().toLowerCase();
      if (displayedNames.has(name)) return false;
      displayedNames.add(name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
}
