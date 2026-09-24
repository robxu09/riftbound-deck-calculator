import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { Card, RiftboundApiService } from './riftbound-api.service';
import { DrawFilters, MulliganPractice } from './mulligan-practice';

@Component({
  selector: 'app-mulligan-practice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mulligan-practice.component.html'
})
export class MulliganPracticeComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) deckId!: string;
  session: MulliganPractice | null = null;
  catalog = new Map<string, Card>();
  loading = false;
  error = '';
  versionNumber = 0;
  filters: DrawFilters = { name: '', type: '', cost: null };
  drawCount = 3;
  get probabilityTypes(): string[] { return [...new Set([...this.catalog.values()].map(card => card.type))].sort(); }
  get probabilityCosts(): number[] {
    return [...new Set([...this.catalog.values()].map(card => card.cost).filter((cost): cost is number => cost !== null))].sort((a, b) => a - b);
  }
  private subscription?: Subscription;

  constructor(private api: RiftboundApiService) {}

  ngOnChanges(): void { this.load(); }

  get probabilitySummary(): string {
    if (!this.session) return '';
    if (!Number.isInteger(this.drawCount) || this.drawCount < 1) return 'Enter a positive whole number of draws.';
    const result = this.session.probabilityFor(this.filters, this.drawCount, this.catalog);
    if (!result) return 'Choose one or more filters.';
    return 'At least one match in the next ' + result.drawCount + ' draws: ' + result.percent.toFixed(1) + '%';
  }

  get matchStateSummary(): string {
    const status = this.session?.matchStatus(this.filters, this.catalog);
    return status ? 'In hand: ' + status.inHand + '; still in deck: ' + status.inDeck + '; cards left: ' + status.cardsLeft + '.' : '';
  }

  load(): void {
    this.subscription?.unsubscribe();
    this.session = null;
    this.error = '';
    this.loading = true;
    this.subscription = forkJoin({ versions: this.api.getDeckVersions(this.deckId), cards: this.api.getCards() })
      .subscribe({
        next: ({ versions, cards }) => {
          this.loading = false;
          this.catalog = new Map(cards.map(card => [card.id, card]));
          const latest = versions.at(-1);
          if (!latest) { this.error = 'Save a deck version before starting practice.'; return; }
          this.versionNumber = versions.length;
          try {
            const session = new MulliganPractice(latest.cards);
            if (latest.cards.some(entry => (entry.section ?? 'MAIN_DECK') === 'MAIN_DECK' && !this.catalog.has(entry.cardId))) {
              throw new Error('Some Main Deck cards are missing from the catalog. Refresh the catalog before practicing.');
            }
            this.session = session;
          } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unable to start practice.';
          }
        },
        error: () => {
          this.loading = false;
          this.error = 'Unable to load the saved deck and card details. Try again.';
        }
      });
  }

  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
}
