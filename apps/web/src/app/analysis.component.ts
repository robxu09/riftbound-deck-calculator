import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of, Subscription, switchMap, map } from 'rxjs';
import { Deck, RiftboundApiService } from './riftbound-api.service';
import { MulliganPracticeComponent } from './mulligan-practice.component';

@Component({
  standalone: true,
  imports: [CommonModule, MulliganPracticeComponent],
  templateUrl: './analysis.component.html'
})
export class AnalysisComponent implements OnInit, OnDestroy {
  deck: Deck | null = null;
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
      return this.api.getDeck(params.get('deckId')!).pipe(map(deck => {
        if (!deck) throw new Error('Deck not found');
        return deck;
      }), catchError(() => {
        this.error = 'Unable to load this deck. The deck may have been removed, or the API may be unavailable.';
        return of(null);
      }));
    })).subscribe(result => {
      this.deck = result;
      this.loading = false;
    });
  }

  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
}
