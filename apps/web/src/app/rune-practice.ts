import { Card, DeckCard } from './riftbound-api.service';
import { PracticeCard } from './mulligan-practice';

/** Manual rune movements in an independent pile; no automatic turns or cost payment. */
export class RunePractice {
  private readonly original: PracticeCard[];
  private pile: PracticeCard[] = [];
  inPlay: PracticeCard[] = [];

  constructor(entries: DeckCard[], catalog: ReadonlyMap<string, Card>, private readonly random: () => number = Math.random) {
    const runes = entries.filter(entry => entry.section === 'RUNES');
    if (runes.some(entry => !Number.isInteger(entry.quantity) || entry.quantity < 1)) throw new Error('Invalid rune quantities. Edit and save the deck.');
    if (runes.some(entry => !catalog.has(entry.cardId))) throw new Error('Some runes are missing from the catalog.');
    if (runes.some(entry => catalog.get(entry.cardId)!.type.toLowerCase() !== 'rune')) throw new Error('The Runes section contains a non-rune card.');
    this.original = runes.flatMap(entry => Array.from({ length: entry.quantity }, () => entry.cardId))
      .map((cardId, copyId) => ({ cardId, copyId }));
    this.reset();
  }

  get remaining(): number { return this.pile.length; }
  get total(): number { return this.original.length; }
  get groups(): { cardId: string; copyId: number; quantity: number }[] {
    const groups = new Map<string, { cardId: string; copyId: number; quantity: number }>();
    for (const rune of this.inPlay) {
      const group = groups.get(rune.cardId);
      if (group) group.quantity++; else groups.set(rune.cardId, { ...rune, quantity: 1 });
    }
    return [...groups.values()];
  }

  channel(): void {
    const rune = this.pile.shift();
    if (rune) this.inPlay = [...this.inPlay, rune];
  }

  recycle(copyId: number): void {
    const rune = this.inPlay.find(copy => copy.copyId === copyId);
    if (!rune) return;
    this.inPlay = this.inPlay.filter(copy => copy.copyId !== copyId);
    this.pile.push(rune);
  }

  reset(): void {
    this.pile = [...this.original];
    for (let i = this.pile.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.pile[i], this.pile[j]] = [this.pile[j], this.pile[i]];
    }
    this.inPlay = [];
  }
}
