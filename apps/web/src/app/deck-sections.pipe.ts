import { Pipe, PipeTransform } from '@angular/core';
import { DeckCard, DeckSection } from './riftbound-api.service';

export const DECK_SECTIONS: { id: DeckSection; label: string; target: string }[] = [
  { id: 'LEGEND', label: 'Legend', target: '1' },
  { id: 'CHAMPION', label: 'Champion', target: '1' },
  { id: 'MAIN_DECK', label: 'Main deck', target: '39' },
  { id: 'BATTLEFIELDS', label: 'Battlefields', target: '3' },
  { id: 'RUNES', label: 'Runes', target: '12' },
  { id: 'SIDEBOARD', label: 'Sideboard', target: 'up to 10' }
];

@Pipe({ name: 'deckSections', standalone: true })
export class DeckSectionsPipe implements PipeTransform {
  transform(cards: DeckCard[]) {
    return DECK_SECTIONS.map(section => {
      const entries = cards.filter(card => (card.section ?? 'MAIN_DECK') === section.id);
      return { ...section, cards: entries, count: entries.reduce((sum, card) => sum + card.quantity, 0) };
    });
  }
}
