import { Card, DeckCard } from './riftbound-api.service';
import { matchesKeywords } from './card-keywords';

export interface OpeningFilters {
  name: string;
  keyword?: string;
  type: string;
  cost: number | null;
  comparison: 'exact' | 'atMost' | 'atLeast';
}

export function matchesOpeningCard(card: Card, filters: OpeningFilters): boolean {
  if (!filters.name.trim().toLowerCase().split(/\s+/).filter(Boolean).every(word => card.name.toLowerCase().includes(word))) return false;
  if (!matchesKeywords(card.text, filters.keyword)) return false;
  if (filters.type.trim() && card.type.toLowerCase() !== filters.type.trim().toLowerCase()) return false;
  if (filters.cost === null) return true;
  if (card.cost === null || !Number.isFinite(card.cost)) return false;
  return filters.comparison === 'atMost' ? card.cost <= filters.cost
    : filters.comparison === 'atLeast' ? card.cost >= filters.cost : card.cost === filters.cost;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
  return result;
}

/** Exact opening-four odds, independent of the shuffled practice session. */
export function openingHandOdds(entries: DeckCard[], catalog: ReadonlyMap<string, Card>, filters: OpeningFilters, minimum: number) {
  const main = entries.filter(entry => (entry.section ?? 'MAIN_DECK') === 'MAIN_DECK');
  if (main.some(entry => !Number.isInteger(entry.quantity) || entry.quantity < 1) ||
      main.reduce((sum, entry) => sum + entry.quantity, 0) !== 39) {
    return { error: 'Requires 39 Main Deck cards.', matches: 0, percent: null };
  }
  if (main.some(entry => !catalog.has(entry.cardId))) {
    return { error: 'Some Main Deck cards are missing from the catalog.', matches: 0, percent: null };
  }
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > 4 ||
      (filters.cost !== null && (!Number.isInteger(filters.cost) || filters.cost < 0))) {
    return { error: 'Choose a valid cost and 1 to 4 matching cards.', matches: 0, percent: null };
  }
  if (!filters.name.trim() && !filters.keyword?.trim() && !filters.type.trim() && filters.cost === null) {
    return { error: 'Choose one or more filters.', matches: 0, percent: null };
  }
  const matches = main.reduce((sum, entry) => sum + (matchesOpeningCard(catalog.get(entry.cardId)!, filters) ? entry.quantity : 0), 0);
  let outcomes = 0;
  for (let count = minimum; count <= 4; count++) outcomes += choose(matches, count) * choose(39 - matches, 4 - count);
  return { error: '', matches, percent: Math.min(100, Math.max(0, 100 * outcomes / choose(39, 4))) };
}
