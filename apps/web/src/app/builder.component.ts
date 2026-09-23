import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CardSearchPipe } from './card-search.pipe';
import { DeckSectionsPipe } from './deck-sections.pipe';
import { DeckWorkspace } from './deck-workspace.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardSearchPipe, DeckSectionsPipe],
  templateUrl: './builder.component.html'
})
export class BuilderComponent implements OnInit, OnDestroy {
  mobileTab: 'deck' | 'cards' = 'deck';
  private subscriptions = new Subscription();
  private requestedId: string | null = null;
  constructor(public vm: DeckWorkspace, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.vm.loadCards();
    this.vm.loadFormats();
    this.subscriptions.add(this.route.paramMap.subscribe(params => {
      this.requestedId = params.get('deckId');
      if (this.requestedId) {
        this.vm.loadDeck(this.requestedId);
      } else if (!this.vm.consumeImportedDraft()) {
        this.vm.newDraft();
      }
    }));
    this.subscriptions.add(this.vm.saved.subscribe(deck => {
      void this.router.navigate(['/builder', deck.id], { replaceUrl: true });
    }));
  }

  get cannotEdit(): boolean {
    return !!this.requestedId && !this.vm.loadingDeck && !this.vm.loadedDeck;
  }

  retry(): void { if (this.requestedId) this.vm.loadDeck(this.requestedId); }

  canLeave(): boolean {
    if (this.vm.busy) {
      this.vm.saveStatus = 'Please wait for the save to finish before leaving.';
      return false;
    }
    return !this.vm.dirty || window.confirm('Leave this page and discard unsaved deck changes?');
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.vm.dirty || this.vm.busy) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.vm.leaveBuilder();
  }
}
