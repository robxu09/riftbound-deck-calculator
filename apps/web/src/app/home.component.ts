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
  get selectedDeckId(): string | null { return this.vm.homeDeckId; }
  set selectedDeckId(id: string | null) { this.vm.homeDeckId = id; }
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
    this.vm.deleteDeck(id);
    if (this.selectedDeckId === id) this.selectedDeckId = null;
  }
}
