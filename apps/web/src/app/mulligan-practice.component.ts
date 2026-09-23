import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { Card, RiftboundApiService } from './riftbound-api.service';
import { MulliganPractice } from './mulligan-practice';

@Component({
  selector: 'app-mulligan-practice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mulligan-practice.component.html'
})
export class MulliganPracticeComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) deckId!: string;
  session: MulliganPractice | null = null;
  catalog = new Map<string, Card>();
  loading = false;
  error = '';
  versionNumber = 0;
  private subscription?: Subscription;

  constructor(private api: RiftboundApiService) {}

  ngOnChanges(): void { this.load(); }

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
