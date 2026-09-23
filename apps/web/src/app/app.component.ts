import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardSearchPipe } from './card-search.pipe';
import { DeckAnalysisResult, RiftboundApiService, type Card, type Deck, type DeckCard, type Format } from './riftbound-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CardSearchPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  cards: Card[] = [];
  formats: Format[] = [];
  savedDecks: Deck[] = [];
  selectedFormatId = 'format-constructed';
  cardSearch = '';
  deckName = 'My First Deck';
  deckId: string | null = null;
  selectedDeckCards: DeckCard[] = [];
  analysis: DeckAnalysisResult | null = null;

  constructor(private api: RiftboundApiService) {}

  ngOnInit(): void {
    this.loadCards();
    this.loadFormats();
    this.loadSavedDecks();
  }

  loadCards(): void {
    this.api.getCards().subscribe({
      next: (cards) => this.cards = cards,
      error: () => console.error('Failed to load cards')
    });
  }

  loadFormats(): void {
    this.api.getFormats().subscribe({
      next: (formats) => {
        this.formats = formats;
        if (formats.length && !formats.some(format => format.id === this.selectedFormatId)) {
          this.selectedFormatId = formats[0].id;
        }
      },
      error: () => console.error('Failed to load formats')
    });
  }

  loadSavedDecks(): void {
    this.api.getDecks().subscribe({
      next: (decks) => {
        this.savedDecks = decks;
      },
      error: () => console.error('Failed to load saved decks')
    });
  }

  loadDeck(deckId: string): void {
    this.api.getDeck(deckId).subscribe({
      next: (deck) => {
        this.deckId = deck.id;
        this.deckName = deck.name;
        this.selectedFormatId = deck.formatId;
        this.analysis = null;

        this.api.getDeckVersions(deckId).subscribe({
          next: (versions) => {
            const latestVersion = versions.at(-1);
            this.selectedDeckCards = latestVersion?.cards ?? [];
          },
          error: () => console.error('Failed to load deck versions')
        });
      },
      error: () => console.error('Failed to load deck')
    });
  }

  addCardToDeck(cardId: string): void {
    const existing = this.selectedDeckCards.find((card) => card.cardId === cardId);
    if (existing) {
      existing.quantity += 1;
      return;
    }

    this.selectedDeckCards.push({ cardId, quantity: 1 });
  }

  removeCardFromDeck(cardId: string): void {
    const existing = this.selectedDeckCards.find((card) => card.cardId === cardId);
    if (!existing) {
      return;
    }

    if (existing.quantity > 1) {
      existing.quantity -= 1;
      return;
    }

    this.selectedDeckCards = this.selectedDeckCards.filter((card) => card.cardId !== cardId);
  }

  clearSelectedDeckCards(): void {
    this.selectedDeckCards = [];
  }

  deleteDeck(deckId: string): void {
    this.api.deleteDeck(deckId).subscribe({
      next: () => {
        this.savedDecks = this.savedDecks.filter((deck) => deck.id !== deckId);
        if (this.deckId === deckId) {
          this.deckId = null;
          this.selectedDeckCards = [];
          this.analysis = null;
        }
      },
      error: () => console.error('Failed to delete deck')
    });
  }

  createDeck(): void {
    this.api.createDeck({ name: this.deckName, formatId: this.selectedFormatId }).subscribe({
      next: (deck) => {
        this.deckId = deck.id;
        this.loadSavedDecks();
        this.addDeckVersion();
      },
      error: () => console.error('Failed to create deck')
    });
  }

  addDeckVersion(): void {
    if (!this.deckId) {
      return;
    }

    this.api.addDeckVersion(this.deckId, { cards: this.selectedDeckCards, notes: 'Initial version' }).subscribe({
      next: () => {
        this.loadSavedDecks();
        this.analyzeDeck();
      },
      error: () => console.error('Failed to save deck version')
    });
  }

  analyzeDeck(): void {
    if (!this.deckId) {
      return;
    }

    this.api.analyzeDeck({ deckId: this.deckId, formatId: this.selectedFormatId, analysisType: 'summary' }).subscribe({
      next: (result) => {
        this.analysis = result;
      },
      error: () => console.error('Failed to analyze deck')
    });
  }

  getCardName(cardId: string): string {
    return this.cards.find((card) => card.id === cardId)?.name ?? 'Unknown card';
  }

  objectKeys(value: Record<string, number>): string[] {
    return Object.keys(value ?? {});
  }
}
