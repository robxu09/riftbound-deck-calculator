import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DeckSectionsPipe } from './deck-sections.pipe';
import { DeckWorkspace } from './deck-workspace.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DeckSectionsPipe],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  showImport = false;
  showActions = false;
  get selectedDeckId(): string | null {
    return this.vm.savedDecks.some(deck => deck.id === this.vm.homeDeckId)
      ? this.vm.homeDeckId : this.vm.savedDecks[0]?.id ?? null;
  }
  set selectedDeckId(id: string | null) {
    this.vm.homeDeckId = id;
    this.showActions = false;
    this.vm.deckAction = null;
    this.vm.actionError = '';
    this.vm.actionStatus = '';
  }
  constructor(public vm: DeckWorkspace, private router: Router) {}

  ngOnInit(): void {
    this.vm.loadSavedDecks();
  }

  get selectedDeck() { return this.vm.savedDecks.find(deck => deck.id === this.selectedDeckId); }

  acceptImport(): void {
    if (!this.vm.importPreview || this.vm.importPreview.errors.length) return;
    this.vm.newDraftFromImport();
    void this.router.navigate(['/builder/new']);
  }

  removeDeck(id: string): void {
    const deck = this.vm.savedDecks.find(deck => deck.id === id);
    if (!deck || this.vm.actionBusy) return;
    if (!window.confirm(`Delete "${deck.name}"? This permanently deletes the deck and its saved state.`)) return;
    this.vm.deleteDeck(id);
  }
}
