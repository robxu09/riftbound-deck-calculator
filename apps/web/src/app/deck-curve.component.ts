import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card, DeckCard } from './riftbound-api.service';
import { CurveMetric, CurveScope } from './deck-curve';
import { DeckCurvePipe } from './deck-curve.pipe';

@Component({
  selector: 'app-deck-curve', standalone: true,
  imports: [CommonModule, FormsModule, DeckCurvePipe],
  templateUrl: './deck-curve.component.html'
})
export class DeckCurveComponent {
  @Input() entries: DeckCard[] = [];
  @Input() catalog: Card[] = [];
  metric: CurveMetric = 'cost';
  scope: CurveScope = 'mainChampion';
  readonly colors = ['#a78bfa', '#38bdf8', '#fb923c', '#4ade80', '#f472b6', '#facc15', '#94a3b8'];
}
