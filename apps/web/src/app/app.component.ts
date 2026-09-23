import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardSearchPipe } from './card-search.pipe';
import { DECK_SECTIONS, DeckSectionsPipe } from './deck-sections.pipe';
import { DeckImportResult, DeckSection } from './riftbound-api.service';
import { DeckAnalysisResult, RiftboundApiService, type Card, type Deck, type DeckCard, type Format } from './riftbound-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CardSearchPipe, DeckSectionsPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  cards: Card[] = [];
  formats: Format[] = [];
  savedDecks: Deck[] = [];
  selectedFormatId = 'format-constructed';
  cardSearch = '';
  cardType = '';
  cardDomain = '';
  readonly cardTypes = ['Legend', 'Unit', 'Spell', 'Battlefield', 'Rune', 'Gear', 'Unknown'];
  readonly cardDomains = ['Body', 'Calm', 'Chaos', 'Fury', 'Mind', 'Order', 'Colorless'];
  deckName = 'My First Deck';
  deckId: string | null = null;
  selectedDeckCards: DeckCard[] = [];
  analysis: DeckAnalysisResult | null = null;
  readonly sections = DECK_SECTIONS;
  addToSection: DeckSection = 'MAIN_DECK';
  importText = '';
  importPreview: DeckImportResult | null = null;
  importError = '';
  importBusy = false;
  importStatus = '';
  private importGeneration = 0;
  private selectionGeneration = 0;
  creatingDeck = false;
  deckError = '';

  resetImportPreview(): void {
    this.importGeneration++;
    this.importPreview = null;
    this.importError = '';
    this.importStatus = '';
    this.importBusy = false;
  }

  async readDeckFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.resetImportPreview();
    const generation = this.importGeneration;
    if (file.size > 100_000) {
      this.importError = 'Choose a text file smaller than 100 KB.';
      input.value = '';
      return;
    }
    try {
      const text = await file.text();
      if (generation !== this.importGeneration) return;
      this.importText = text;
    } catch {
      if (generation === this.importGeneration) this.importError = 'Unable to read this file. Try pasting its text instead.';
    } finally {
      input.value = '';
    }
  }

  previewTextImport(): void {
    this.resetImportPreview();
    this.importBusy = true;
    const generation = this.importGeneration;
    this.api.previewImport(this.importText).subscribe({
      next: result => {
        if (generation !== this.importGeneration) return;
        this.importPreview = result;
        this.importBusy = false;
      },
      error: () => {
        if (generation !== this.importGeneration) return;
        this.importError = 'Unable to preview the import. Check that the API is running.';
        this.importBusy = false;
      }
    });
  }

  useImportedDeck(): void {
    if (!this.importPreview || this.importPreview.errors.length || !this.importPreview.cards.length) return;
    this.selectionGeneration++;
    this.deckError = '';
    this.selectedDeckCards = this.importPreview.cards.map(card => ({ ...card }));
    this.deckId = null;
    this.analysis = null;
    this.resetImportPreview();
    this.importStatus = 'Imported into a new draft. Set the deck name above, then click Save selection as new deck.';
  }

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
    const generation = ++this.selectionGeneration;
    this.selectedDeckCards = [];
    this.analysis = null;
    this.deckId = null;
    this.deckError = '';
    this.resetImportPreview();
    this.api.getDeck(deckId).subscribe({
      next: (deck) => {
        if (generation !== this.selectionGeneration) return;
        this.deckId = deck.id;
        this.deckName = deck.name;
        this.selectedFormatId = deck.formatId;
        this.analysis = null;

        this.api.getDeckVersions(deckId).subscribe({
          next: (versions) => {
            if (generation !== this.selectionGeneration) return;
            const latestVersion = versions.at(-1);
            this.selectedDeckCards = latestVersion?.cards ?? [];
          },
          error: () => {
            if (generation === this.selectionGeneration) this.deckError = 'Failed to load deck versions.';
          }
        });
      },
      error: () => {
        if (generation === this.selectionGeneration) this.deckError = 'Failed to load deck.';
      }
    });
  }

  addCardToDeck(cardId: string): void {
    const existing = this.selectedDeckCards.find(card => card.cardId === cardId && (card.section ?? 'MAIN_DECK') === this.addToSection);
    this.analysis = null;
    if (existing) {
      this.selectedDeckCards = this.selectedDeckCards.map(card => card === existing ? { ...card, quantity: card.quantity + 1 } : card);
      return;
    }

    this.selectedDeckCards = [...this.selectedDeckCards, { cardId, quantity: 1, section: this.addToSection }];
  }

  removeCardFromDeck(cardId: string, section: DeckSection = 'MAIN_DECK'): void {
    const existing = this.selectedDeckCards.find(card => card.cardId === cardId && (card.section ?? 'MAIN_DECK') === section);
    if (!existing) {
      return;
    }

    if (existing.quantity > 1) {
      this.selectedDeckCards = this.selectedDeckCards.map(card => card === existing ? { ...card, quantity: card.quantity - 1 } : card);
      this.analysis = null;
      return;
    }

    this.selectedDeckCards = this.selectedDeckCards.filter(card => card !== existing);
    this.analysis = null;
  }

  clearSelectedDeckCards(): void {
    this.selectedDeckCards = [];
    this.analysis = null;
  }

  deleteDeck(deckId: string): void {
    this.api.deleteDeck(deckId).subscribe({
      next: () => {
        this.savedDecks = this.savedDecks.filter((deck) => deck.id !== deckId);
        if (this.deckId === deckId) {
          this.selectionGeneration++;
          this.deckId = null;
          this.selectedDeckCards = [];
          this.analysis = null;
        }
      },
      error: () => console.error('Failed to delete deck')
    });
  }

  createDeck(includeSelection = false): void {
    if (this.creatingDeck) return;
    const cards = includeSelection ? this.selectedDeckCards.map(card => ({ ...card })) : [];
    const generation = ++this.selectionGeneration;
    this.creatingDeck = true;
    this.deckError = '';
    this.api.createDeck({ name: this.deckName, formatId: this.selectedFormatId, cards }).subscribe({
      next: (deck) => {
        this.creatingDeck = false;
        this.loadSavedDecks();
        if (generation !== this.selectionGeneration) return;
        this.deckId = deck.id;
        this.deckName = deck.name;
        this.selectedFormatId = deck.formatId;
        this.selectedDeckCards = cards;
        this.analysis = null;
        this.addToSection = 'MAIN_DECK';
        this.resetImportPreview();
        this.importText = '';
        this.analyzeDeck();
      },
      error: error => {
        this.creatingDeck = false;
        if (generation !== this.selectionGeneration) return;
        this.deckError = error.error?.error ?? 'Failed to create deck. Please try again.';
      }
    });
  }

  addDeckVersion(): void {
    if (!this.deckId) {
      return;
    }

    const deckId = this.deckId;
    const generation = this.selectionGeneration;
    const cards = this.selectedDeckCards;
    this.api.addDeckVersion(deckId, { cards, notes: 'Saved version' }).subscribe({
      next: () => {
        this.loadSavedDecks();
        if (generation !== this.selectionGeneration || deckId !== this.deckId || cards !== this.selectedDeckCards) return;
        this.analyzeDeck();
      },
      error: () => {
        if (generation === this.selectionGeneration) this.deckError = 'Failed to save deck version.';
      }
    });
  }

  analyzeDeck(): void {
    if (!this.deckId) {
      return;
    }

    const generation = this.selectionGeneration;
    const cards = this.selectedDeckCards;
    this.api.analyzeDeck({ deckId: this.deckId, formatId: this.selectedFormatId, analysisType: 'summary' }).subscribe({
      next: (result) => {
        if (generation !== this.selectionGeneration || cards !== this.selectedDeckCards) return;
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
