import { Card, DeckCard } from './riftbound-api.service';

export type CurveMetric = 'cost' | 'power';
export type CurveScope = 'mainChampion' | 'main' | 'sideboard';
export interface CurveBucket { value: number; total: number; counts: Record<string, number>; }

export function buildDeckCurve(entries: DeckCard[], catalog: Card[], metric: CurveMetric, scope: CurveScope) {
  const byId = new Map(catalog.map(card => [card.id, card]));
  const buckets = new Map<number, CurveBucket>();
  const types = new Set<string>();
  let total = 0;
  let missing = 0;
  for (const entry of entries) {
    const section = entry.section ?? 'MAIN_DECK';
    const included = scope === 'sideboard' ? section === 'SIDEBOARD'
      : section === 'MAIN_DECK' || (scope === 'mainChampion' && section === 'CHAMPION');
    if (!included) continue;
    total += entry.quantity;
    const card = byId.get(entry.cardId);
    const value = card?.[metric];
    if (value == null || !Number.isFinite(value)) { missing += entry.quantity; continue; }
    const type = card?.type || 'Unknown';
    types.add(type);
    const bucket = buckets.get(value) ?? { value, total: 0, counts: {} };
    bucket.total += entry.quantity;
    bucket.counts[type] = (bucket.counts[type] ?? 0) + entry.quantity;
    buckets.set(value, bucket);
  }
  const rows = [...buckets.values()].sort((a, b) => a.value - b.value);
  return { rows, types: [...types].sort(), total, missing, max: Math.max(1, ...rows.map(row => row.total)) };
}
