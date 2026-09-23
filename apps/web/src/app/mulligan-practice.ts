import { DeckCard } from './riftbound-api.service';

export interface PracticeCard {
  copyId: number;
  cardId: string;
}

/** Local card handling for an interactive practice session, independent of Angular. */
export class MulliganPractice {
  private readonly original: PracticeCard[];
  private pile: PracticeCard[] = [];
  hand: PracticeCard[] = [];
  selected: number[] = [];
  draws: PracticeCard[] = [];
  choosing = true;

  constructor(entries: DeckCard[], private readonly random: () => number = Math.random) {
    const main = entries.filter(entry => (entry.section ?? 'MAIN_DECK') === 'MAIN_DECK');
    if (main.some(entry => !Number.isInteger(entry.quantity) || entry.quantity < 1) ||
        main.reduce((total, entry) => total + entry.quantity, 0) !== 39) {
      throw new Error('Mulligan practice needs 39 cards in the Main Deck section. Edit and save the deck, then reload analysis.');
    }
    this.original = main.flatMap(entry => Array.from({ length: entry.quantity }, () => entry.cardId))
      .map((cardId, copyId) => ({ cardId, copyId }));
    this.reset();
  }

  get remaining(): number { return this.pile.length; }

  confirm(): void {
    if (!this.choosing) return;
    const bottom = this.selected.map(id => this.hand.find(card => card.copyId === id)!);
    this.hand = this.hand.filter(card => !this.selected.includes(card.copyId));
    this.pile.push(...bottom);
    this.hand = [...this.hand, ...this.pile.splice(0, bottom.length)];
    this.selected = [];
    this.choosing = false;
  }

  reset(): void {
    this.pile = [...this.original];
    for (let i = this.pile.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.pile[i], this.pile[j]] = [this.pile[j], this.pile[i]];
    }
    this.hand = this.pile.splice(0, 4);
    this.selected = [];
    this.draws = [];
    this.choosing = true;
  }

  toggle(copyId: number): void {
    if (!this.choosing || !this.hand.some(card => card.copyId === copyId)) return;
    if (this.selected.includes(copyId)) this.selected = this.selected.filter(id => id !== copyId);
    else if (this.selected.length < 2) this.selected = [...this.selected, copyId];
  }

  draw(): void {
    if (this.choosing) return;
    const next = this.pile.shift();
    if (!next) return;
    this.hand = [...this.hand, next];
    this.draws = [...this.draws, next];
  }
}
