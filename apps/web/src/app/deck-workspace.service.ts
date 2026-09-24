import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { DECK_SECTIONS } from './deck-sections.pipe';
import { DeckFileService } from './deck-file.service';
import { DeckImportResult, DeckSection, RiftboundApiService, Card, Deck, DeckCard, Format } from './riftbound-api.service';

@Injectable({ providedIn: 'root' })
export class DeckWorkspace {
  homeDeckId: string | null = null;
  readonly saved = new Subject<Deck>();
  loadingDeck = false;
  loadedDeck = false;
  savingVersion = false;
  saveStatus = '';
  listError = '';
  loadingDecks = false;
  catalogError = '';
  private baseline = '';
  private importedDraft = false;
  private pendingImportedDraft = false;

  private snapshot(): string {
    return JSON.stringify([this.deckName, this.selectedFormatId, this.selectedDeckCards]);
  }

  get dirty(): boolean { return this.importedDraft || (!!this.baseline && this.snapshot() !== this.baseline); }
  get busy(): boolean { return this.creatingDeck || this.savingVersion; }
  markSaved(): void { this.baseline = this.snapshot(); this.importedDraft = false; }

  newDraft(): void {
    this.selectionGeneration++;
    this.deckId = null;
    this.deckName = '';
    this.selectedFormatId = this.formats[0]?.id ?? 'format-constructed';
    this.selectedDeckCards = [];
    this.deckError = '';
    this.saveStatus = '';
    this.loadingDeck = false;
    this.loadedDeck = false;
    this.addToSection = 'MAIN_DECK';
    this.resetImportPreview();
    this.markSaved();
  }

  leaveBuilder(): void { this.selectionGeneration++; this.loadingDeck = false; }

  cards: Card[] = [];
  formats: Format[] = [];
  savedDecks: Deck[] = [];
  selectedFormatId = 'format-constructed';
  cardSearch = '';
  cardType = '';
  cardDomain = '';
  cardSet = '';
  cardCost: number | null = null;
  get cardCosts(): number[] {
    return [...new Set(this.cards.map(card => card.cost).filter((cost): cost is number => cost !== null))].sort((a, b) => a - b);
  }
  get cardSets(): string[] {
    return [...new Set(this.cards.map(card => card.setCode.trim().toUpperCase()).filter(Boolean))].sort();
  }
  readonly cardTypes = ['Legend', 'Unit', 'Spell', 'Battlefield', 'Rune', 'Gear', 'Unknown'];
  readonly cardDomains = ['Body', 'Calm', 'Chaos', 'Fury', 'Mind', 'Order', 'Colorless'];
  deckName = '';
  deckId: string | null = null;
  selectedDeckCards: DeckCard[] = [];
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
  deckAction: { deck: Deck; mode: 'rename' | 'duplicate' } | null = null;
  actionName = '';
  actionBusy = false;
  actionError = '';
  actionStatus = '';

  beginDeckAction(deck: Deck, mode: 'rename' | 'duplicate'): void {
    if (this.actionBusy) return;
    this.deckAction = { deck, mode };
    this.actionName = mode === 'rename' ? deck.name : `${deck.name} copy`;
    this.actionError = '';
    this.actionStatus = '';
  }

  submitDeckAction(): void {
    if (!this.deckAction || this.actionBusy) return;
    const { deck, mode } = this.deckAction;
    this.actionBusy = true;
    this.actionError = '';
    const request = mode === 'rename'
      ? this.api.renameDeck(deck.id, this.actionName)
      : this.api.duplicateDeck(deck.id, this.actionName);
    request.subscribe({
      next: updated => {
        this.actionBusy = false;
        this.deckAction = null;
        this.loadSavedDecks();
        if (mode === 'rename' && this.deckId === updated.id) {
          this.deckName = updated.name;
        }
        this.actionStatus = mode === 'rename' ? `Renamed to ${updated.name}.` : `Created ${updated.name} from the current deck state. Select it to open the copy.`;
      },
      error: error => {
        this.actionBusy = false;
        this.actionError = error.error?.error ?? `Unable to ${mode} this deck.`;
      }
    });
  }

  exportSavedDeck(deck: Deck): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.actionError = '';
    this.actionStatus = '';
    this.api.exportDeck(deck.id).subscribe({
      next: text => {
        this.actionBusy = false;
        this.deckFiles.download(text, deck.name);
        this.actionStatus = `Exported the current deck state for ${deck.name}.`;
      },
      error: error => {
        this.actionBusy = false;
        // HttpClient's text response mode also returns JSON error bodies as text.
        try { this.actionError = JSON.parse(error.error).error ?? 'Unable to export this deck.'; }
        catch { this.actionError = 'Unable to export this deck.'; }
      }
    });
  }

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

  newDraftFromImport(): void {
    const preview = this.importPreview;
    if (!preview || preview.errors.length) return;
    this.newDraft();
    this.importPreview = preview;
    this.useImportedDeck();
    this.pendingImportedDraft = true;
  }

  consumeImportedDraft(): boolean {
    const pending = this.pendingImportedDraft;
    this.pendingImportedDraft = false;
    return pending;
  }

  useImportedDeck(): void {
    if (!this.importPreview || this.importPreview.errors.length) return;
    this.selectionGeneration++;
    this.deckError = '';
    this.selectedDeckCards = this.importPreview.cards.map(card => ({ ...card }));
    this.deckId = null;
    this.resetImportPreview();
    this.deckName = '';
    this.importedDraft = true;
    this.importStatus = 'Imported into a new draft. Choose a name and save when ready.';
  }

  constructor(private api: RiftboundApiService, private deckFiles: DeckFileService = new DeckFileService()) {}

  loadCards(): void {
    this.api.getCards().subscribe({
      next: (cards) => { this.cards = cards; this.catalogError = ''; },
      error: () => this.catalogError = 'Unable to load cards. Check the API and try again.'
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
      error: () => this.catalogError = 'Unable to load formats. Check the API and try again.'
    });
  }

  loadSavedDecks(): void {
    this.listError = '';
    this.loadingDecks = true;
    this.api.getDecks().subscribe({
      next: (decks) => {
        this.savedDecks = decks;
        this.loadingDecks = false;
      },
      error: () => {
        this.loadingDecks = false;
        this.listError = 'Unable to load saved decks. Check the API and try again.';
      }
    });
  }

  loadDeck(deckId: string): void {
    this.loadedDeck = false;
    this.loadingDeck = true;
    this.saveStatus = '';
    this.baseline = '';
    this.importedDraft = false;
    const generation = ++this.selectionGeneration;
    this.selectedDeckCards = [];
    this.deckId = null;
    this.deckError = '';
    this.resetImportPreview();
    this.api.getDeck(deckId).subscribe({
      next: (deck) => {
        if (generation !== this.selectionGeneration) return;
        if (!deck) { this.loadingDeck = false; this.deckError = 'This deck no longer exists.'; return; }
        this.deckId = deck.id;
        this.homeDeckId = deck.id;
        this.deckName = deck.name;
        this.selectedFormatId = deck.formatId;

        this.api.getDeckVersions(deckId).subscribe({
          next: (versions) => {
            if (generation !== this.selectionGeneration) return;
            const latestVersion = versions.at(-1);
            this.selectedDeckCards = latestVersion?.cards ?? [];
            this.loadingDeck = false;
            this.loadedDeck = true;
            this.markSaved();
          },
          error: () => {
            if (generation === this.selectionGeneration) { this.loadingDeck = false; this.deckError = 'Failed to load deck versions.'; }
          }
        });
      },
      error: () => {
        if (generation === this.selectionGeneration) { this.loadingDeck = false; this.deckError = 'Failed to load deck.'; }
      }
    });
  }

  addCardToDeck(cardId: string): void {
    const existing = this.selectedDeckCards.find(card => card.cardId === cardId && (card.section ?? 'MAIN_DECK') === this.addToSection);
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
      return;
    }

    this.selectedDeckCards = this.selectedDeckCards.filter(card => card !== existing);
  }

  clearSelectedDeckCards(): void {
    this.selectedDeckCards = [];
  }

  deleteDeck(deckId: string): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.actionError = '';
    this.actionStatus = '';
    this.api.deleteDeck(deckId).subscribe({
      next: result => {
        this.actionBusy = false;
        if (!result.deleted) {
          this.actionError = 'The deck could not be deleted. Refresh the deck list and try again.';
          return;
        }
        this.savedDecks = this.savedDecks.filter((deck) => deck.id !== deckId);
        if (this.homeDeckId === deckId || !this.savedDecks.some(deck => deck.id === this.homeDeckId)) {
          this.homeDeckId = this.savedDecks[0]?.id ?? null;
        }
        this.deckAction = null;
        this.actionStatus = 'Deck deleted.';
        if (this.deckId === deckId) {
          this.selectionGeneration++;
          this.deckId = null;
          this.selectedDeckCards = [];
        }
      },
      error: () => {
        this.actionBusy = false;
        this.actionError = 'Unable to delete this deck. Try again.';
      }
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
        this.homeDeckId = deck.id;
        this.deckName = deck.name;
        this.selectedFormatId = deck.formatId;
        this.selectedDeckCards = cards;
        this.addToSection = 'MAIN_DECK';
        this.resetImportPreview();
        this.importText = '';
        this.markSaved();
        this.saveStatus = 'Deck saved.';
        this.saved.next(deck);
      },
      error: error => {
        this.creatingDeck = false;
        if (generation !== this.selectionGeneration) return;
        this.deckError = error.error?.error ?? 'Failed to create deck. Please try again.';
      }
    });
  }

  addDeckVersion(): void {
    if (!this.deckId || this.busy) {
      return;
    }
    this.savingVersion = true;
    this.deckError = "";

    const deckId = this.deckId;
    const generation = this.selectionGeneration;
    const cards = this.selectedDeckCards;
    this.api.addDeckVersion(deckId, { cards, notes: 'Saved version' }).subscribe({
      next: () => {
        this.savingVersion = false;
        this.loadSavedDecks();
        if (generation !== this.selectionGeneration || deckId !== this.deckId || cards !== this.selectedDeckCards) return;
        this.markSaved();
        this.saveStatus = 'Deck saved.';
      },
      error: () => {
        this.savingVersion = false;
        if (generation === this.selectionGeneration) this.deckError = 'Failed to save deck.';
      }
    });
  }

  getCardName(cardId: string): string {
    return this.cards.find((card) => card.id === cardId)?.name ?? 'Unknown card';
  }

}
