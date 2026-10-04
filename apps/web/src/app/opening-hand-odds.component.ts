import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card, DeckCard } from './riftbound-api.service';
import { OpeningFilters, openingHandOdds } from './opening-hand-odds';
import { keywordChoices } from './card-keywords';

@Component({
  selector: 'app-opening-hand-odds', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './opening-hand-odds.component.html'
})
export class OpeningHandOddsComponent {
  @Input() adjusted = false;
  @Input() entries: DeckCard[] = [];
  @Input() catalog: ReadonlyMap<string, Card> = new Map();
  filters: OpeningFilters = { name: '', keyword: '', type: '', cost: null, comparison: 'exact' };
  get keywords(): string[] { return keywordChoices(this.catalog.values()); }
  get costs(): number[] {
    return [...new Set([...this.catalog.values()].map(card => card.cost).filter((cost): cost is number => cost !== null))].sort((a, b) => a - b);
  }
  minimum = 1;
  readonly types = ['Unit', 'Spell', 'Legend', 'Battlefield', 'Rune'];
  get result() { return openingHandOdds(this.entries, this.catalog, this.filters, this.minimum); }
}
