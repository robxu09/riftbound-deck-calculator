import { Card, DeckCard } from './riftbound-api.service';
import { matchesKeywords } from './card-keywords';

export interface DrawFilters { name: string; keyword?: string; type: string; cost: number | null; }
type ProbabilityCard = Pick<Card, 'name' | 'type' | 'cost'> & Partial<Pick<Card, 'text'>>;

export interface PracticeCard {
  copyId: number;
  cardId: string;
}

/** Local card handling for an interactive practice session, independent of Angular. */
export class MulliganPractice {
  private readonly original: PracticeCard[];
  private bottomIds = new Set<number>();
  private pile: PracticeCard[] = [];
  hand: PracticeCard[] = [];
  selected: number[] = [];
  draws: PracticeCard[] = [];
  removed: PracticeCard[] = [];
  choosing = true;
  private pointCount = 0;
  private turnCount = 1;

  get points(): number { return this.pointCount; }
  addPoint(): void { this.pointCount++; }
  subtractPoint(): void { this.pointCount = Math.max(0, this.pointCount - 1); }

  get turn(): number { return this.turnCount; }
  nextTurn(): void { this.turnCount++; }
  previousTurn(): void { this.turnCount = Math.max(1, this.turnCount - 1); }

  constructor(entries: DeckCard[], private readonly random: () => number = Math.random) {
    const main = entries.filter(entry => (entry.section ?? 'MAIN_DECK') === 'MAIN_DECK');
    if (main.some(entry => !Number.isInteger(entry.quantity) || entry.quantity < 1) ||
        main.reduce((total, entry) => total + entry.quantity, 0) !== 39) {
      throw new Error('Requires 39 Main Deck cards.');
    }
    this.original = main.flatMap(entry => Array.from({ length: entry.quantity }, () => entry.cardId))
      .map((cardId, copyId) => ({ cardId, copyId }));
    this.reset();
  }

  get remaining(): number { return this.pile.length; }

  get remainingDeck(): PracticeCard[] { return [...this.pile]; }

  private matches(card: PracticeCard, filters: DrawFilters, catalog: ReadonlyMap<string, ProbabilityCard>): boolean {
    const info = catalog.get(card.cardId);
    if (!info) return false;
    const type = filters.type.trim().toLowerCase();
    return (!type || info.type.toLowerCase() === type) &&
      (filters.cost === null || info.cost === filters.cost) &&
      matchesKeywords(info.text, filters.keyword) &&
      filters.name.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term => info.name.toLowerCase().includes(term));
  }

  private hasFilters(filters: DrawFilters): boolean {
    return !!(filters.name.trim() || filters.keyword?.trim() || filters.type.trim() || filters.cost !== null);
  }

  matchStatus(filters: DrawFilters, catalog: ReadonlyMap<string, ProbabilityCard>) {
    if (!this.hasFilters(filters)) return null;
    const count = (cards: PracticeCard[]) => cards.filter(card => this.matches(card, filters, catalog)).length;
    const inHand = count(this.hand);
    const inDeck = count(this.pile);
    const removed = count(this.removed);
    return { inHand, inDeck, removed, cardsLeft: this.remaining, totalMatches: inHand + inDeck + removed };
  }

  probabilityFor(filters: DrawFilters, drawCount: number, catalog: ReadonlyMap<string, ProbabilityCard>): { drawCount: number; percent: number } | null {
    if (!this.hasFilters(filters) || !Number.isInteger(drawCount) || drawCount < 1) return null;
    const count = Math.min(drawCount, this.remaining);
    // Use the unknown region's composition, never its shuffled order.
    const unknown = this.pile.filter(card => !this.bottomIds.has(card.copyId));
    const bottom = this.pile.filter(card => this.bottomIds.has(card.copyId));
    const reachedBottom = bottom.slice(0, Math.max(0, count - unknown.length));
    if (reachedBottom.some(card => this.matches(card, filters, catalog))) return { drawCount: count, percent: 100 };
    const matches = unknown.filter(card => this.matches(card, filters, catalog)).length;
    const randomDraws = Math.min(count, unknown.length);
    // Hypergeometric complement: miss on every draw, without replacement.
    let miss = 1;
    for (let i = 0; i < randomDraws; i++) {
      if (unknown.length - matches - i <= 0) { miss = 0; break; }
      miss *= (unknown.length - matches - i) / (unknown.length - i);
    }
    return { drawCount: count, percent: Math.max(0, Math.min(100, 100 * (1 - miss))) };
  }

  confirm(): void {
    if (!this.choosing) return;
    const bottom = this.selected.map(id => this.hand.find(card => card.copyId === id)!);
    this.hand = this.hand.filter(card => !this.selected.includes(card.copyId));
    this.bottomIds = new Set(bottom.map(card => card.copyId));
    this.pile.push(...bottom);
    this.hand = [...this.hand, ...this.pile.splice(0, bottom.length)];
    this.selected = [];
    this.choosing = false;
  }

  reset(): void {
    this.pointCount = 0;
    this.turnCount = 1;
    this.bottomIds.clear();
    this.pile = [...this.original];
    for (let i = this.pile.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.pile[i], this.pile[j]] = [this.pile[j], this.pile[i]];
    }
    this.hand = this.pile.splice(0, 4);
    this.selected = [];
    this.draws = [];
    this.removed = [];
    this.choosing = true;
  }

  toggle(copyId: number): void {
    if (!this.choosing || !this.hand.some(card => card.copyId === copyId)) return;
    if (this.selected.includes(copyId)) this.selected = this.selected.filter(id => id !== copyId);
    else if (this.selected.length < 2) this.selected = [...this.selected, copyId];
  }

  removeFromHand(copyId: number): void {
    if (this.choosing) return;
    const card = this.hand.find(copy => copy.copyId === copyId);
    if (!card) return;
    this.hand = this.hand.filter(copy => copy.copyId !== copyId);
    this.removed = [...this.removed, card];
  }

  returnToHand(copyId: number): void {
    if (this.choosing) return;
    const card = this.removed.find(copy => copy.copyId === copyId);
    if (!card) return;
    this.removed = this.removed.filter(copy => copy.copyId !== copyId);
    this.hand = [...this.hand, card];
  }

  draw(): void {
    if (this.choosing) return;
    const next = this.pile.shift();
    if (!next) return;
    this.bottomIds.delete(next.copyId);
    this.hand = [...this.hand, next];
    this.draws = [...this.draws, next];
  }
}
