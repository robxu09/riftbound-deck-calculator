import { Pipe, PipeTransform } from '@angular/core';
import { Card, DeckCard } from './riftbound-api.service';
import { buildDeckCurve, CurveMetric, CurveScope } from './deck-curve';

@Pipe({ name: 'deckCurve', standalone: true })
export class DeckCurvePipe implements PipeTransform {
  transform(entries: DeckCard[], catalog: Card[], metric: CurveMetric, scope: CurveScope) {
    return buildDeckCurve(entries, catalog, metric, scope);
  }
}
