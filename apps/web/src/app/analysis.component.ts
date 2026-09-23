import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of, Subscription, switchMap } from 'rxjs';
import { Deck, DeckAnalysisResult, RiftboundApiService } from './riftbound-api.service';
import { MulliganPracticeComponent } from './mulligan-practice.component';

@Component({
  standalone: true,
  imports: [CommonModule, MulliganPracticeComponent],
  templateUrl: './analysis.component.html'
})
export class AnalysisComponent implements OnInit, OnDestroy {
  deck: Deck | null = null;
  analysis: DeckAnalysisResult | null = null;
  loading = false;
  error = '';
  private subscription?: Subscription;
  constructor(private api: RiftboundApiService, private route: ActivatedRoute) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.subscription?.unsubscribe();
    this.subscription = this.route.paramMap.pipe(switchMap(params => {
      this.loading = true;
      this.error = '';
      this.deck = null;
      this.analysis = null;
      return this.api.getDeck(params.get('deckId')!).pipe(switchMap(deck => {
        if (!deck) throw new Error('Deck not found');
        this.deck = deck;
        return this.api.analyzeDeck({ deckId: deck.id, formatId: deck.formatId, analysisType: 'summary' });
      }), catchError(() => {
        this.error = 'Unable to load saved analysis. The deck may have been removed, or the API may be unavailable.';
        return of(null);
      }));
    })).subscribe(result => {
      this.analysis = result;
      this.loading = false;
    });
  }

  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
}
