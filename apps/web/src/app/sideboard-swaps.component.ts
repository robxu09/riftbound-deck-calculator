import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Card, DeckCard, RiftboundApiService, SideboardPlan, SideboardSwap } from './riftbound-api.service';
import { applySideboardSwaps, availableSwapCards } from './sideboard-lineup';

export interface AnalysisLineup { entries: DeckCard[]; swapCount: number; }

@Component({
  selector: 'app-sideboard-swaps', standalone: true,
  imports: [CommonModule, FormsModule], templateUrl: './sideboard-swaps.component.html'
})
export class SideboardSwapsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) deckId!: string;
  @Input({ required: true }) baseVersionId!: string;
  @Input() entries: DeckCard[] = [];
  @Input() catalog: ReadonlyMap<string, Card> = new Map();
  @Output() lineupChange = new EventEmitter<AnalysisLineup>();
  swaps: SideboardSwap[] = [];
  applied: SideboardSwap[] = [];
  outCardId = '';
  inCardId = '';
  plans: SideboardPlan[] = [];
  selectedPlanId = '';
  planName = '';
  error = '';
  planError = '';
  status = '';
  loadingPlans = false;
  busy = false;
  private requests = new Subscription();
  constructor(private api: RiftboundApiService) {}

  ngOnChanges(): void {
    this.requests.unsubscribe(); this.requests = new Subscription();
    this.swaps = []; this.applied = []; this.plans = [];
    this.selectedPlanId = ''; this.planName = ''; this.outCardId = ''; this.inCardId = '';
    this.error = ''; this.planError = ''; this.status = ''; this.busy = false;
    this.loadPlans();
  }
  get pending(): boolean { return JSON.stringify(this.swaps) !== JSON.stringify(this.applied); }
  get selectedPlan(): SideboardPlan | undefined { return this.plans.find(plan => plan.id === this.selectedPlanId); }
  get stale(): boolean { return !!this.selectedPlan && this.selectedPlan.baseVersionId !== this.baseVersionId; }
  choices(section: 'MAIN_DECK' | 'SIDEBOARD'): DeckCard[] {
    return availableSwapCards(this.entries, this.swaps, section)
      .filter(entry => ['unit', 'spell'].includes(this.catalog.get(entry.cardId)?.type.toLowerCase() ?? ''))
      .sort((a, b) => this.name(a.cardId).localeCompare(this.name(b.cardId)));
  }
  name(id: string): string { return this.catalog.get(id)?.name ?? id; }
  stageSwap(): void {
    const next = [...this.swaps, { outCardId: this.outCardId, inCardId: this.inCardId }];
    try { applySideboardSwaps(this.entries, next, this.catalog); this.swaps = next; this.outCardId = ''; this.inCardId = ''; this.error = ''; this.status = ''; }
    catch (error) { this.error = (error as Error).message; }
  }
  undo(index: number): void { this.swaps = this.swaps.filter((_, i) => i !== index); this.error = ''; this.status = ''; }
  apply(): void {
    try {
      const entries = applySideboardSwaps(this.entries, this.swaps, this.catalog);
      this.applied = this.swaps.map(swap => ({ ...swap }));
      this.lineupChange.emit({ entries, swapCount: this.applied.length });
      this.error = ''; this.status = 'Lineup applied. Practice restarted.';
    } catch (error) { this.error = (error as Error).message; }
  }
  restore(): void {
    this.swaps = []; this.applied = []; this.selectedPlanId = ''; this.planName = '';
    this.outCardId = ''; this.inCardId = ''; this.error = '';
    this.lineupChange.emit({ entries: this.entries.map(entry => ({ ...entry })), swapCount: 0 });
    this.status = 'Saved lineup restored. Practice restarted.';
  }
  loadPlans(): void {
    this.loadingPlans = true; this.planError = '';
    this.requests.add(this.api.getSideboardPlans(this.deckId).subscribe({
      next: plans => { this.plans = plans; this.loadingPlans = false; },
      error: () => { this.planError = 'Unable to load plans. Temporary swaps still work.'; this.loadingPlans = false; }
    }));
  }
  loadSelectedPlan(): void {
    const plan = this.selectedPlan;
    if (!plan || this.stale) return;
    try {
      applySideboardSwaps(this.entries, plan.swaps, this.catalog);
      this.swaps = plan.swaps.map(swap => ({ ...swap })); this.planName = plan.name;
      this.outCardId = ''; this.inCardId = ''; this.error = ''; this.status = 'Plan loaded. Apply to restart practice.';
    } catch (error) { this.error = (error as Error).message; }
  }
  savePlan(update = false): void {
    if (this.busy || (update && (!this.selectedPlan || this.stale))) return;
    try { applySideboardSwaps(this.entries, this.swaps, this.catalog); }
    catch (error) { this.error = (error as Error).message; return; }
    this.busy = true; this.planError = '';
    this.requests.add(this.api.saveSideboardPlan(this.deckId, {
      name: this.planName.trim(), baseVersionId: this.baseVersionId, swaps: this.swaps.map(swap => ({ ...swap }))
    }, update ? this.selectedPlanId : undefined).subscribe({
      next: plan => {
        this.plans = [...this.plans.filter(item => item.id !== plan.id), plan];
        this.selectedPlanId = plan.id; this.planName = plan.name; this.busy = false; this.status = 'Plan saved.';
      },
      error: error => { this.busy = false; this.planError = error.error?.error ?? 'Unable to save plan. Try again.'; }
    }));
  }
  deletePlan(): void {
    const plan = this.selectedPlan;
    if (!plan || this.busy || !window.confirm('Delete sideboard plan "' + plan.name + '"?')) return;
    this.busy = true; this.planError = '';
    this.requests.add(this.api.deleteSideboardPlan(this.deckId, plan.id).subscribe({
      next: () => { this.plans = this.plans.filter(item => item.id !== plan.id); this.selectedPlanId = ''; this.planName = ''; this.busy = false; this.status = 'Plan deleted. Current lineup kept.'; },
      error: () => { this.busy = false; this.planError = 'Unable to delete plan. Try again.'; }
    }));
  }
  ngOnDestroy(): void { this.requests.unsubscribe(); }
}
