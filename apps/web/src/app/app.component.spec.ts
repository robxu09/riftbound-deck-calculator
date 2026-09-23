import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { RiftboundApiService } from './riftbound-api.service';

describe('AppComponent', () => {
  const apiStub = {
    getCards: () => of([]),
    getFormats: () => of([]),
    getDecks: () => of([]),
    getDeck: () => of({ id: 'deck-1', name: 'Test', formatId: 'format-constructed' }),
    getDeckVersions: () => of([]),
    createDeck: () => of({ id: 'deck-1', name: 'Test', formatId: 'format-constructed' }),
    addDeckVersion: () => of({ id: 'version-1', deckId: 'deck-1', cards: [] }),
    analyzeDeck: () => of({
      deckId: 'deck-1',
      formatId: 'format-constructed',
      cardCount: 0,
      uniqueCardCount: 0,
      manaCurve: {},
      summary: 'No cards',
      warnings: []
    })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: RiftboundApiService, useValue: apiStub }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should add and remove cards from the selected deck', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.addCardToDeck('card-1');
    app.addCardToDeck('card-1');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 2 }]);

    app.removeCardFromDeck('card-1');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 1 }]);

    app.removeCardFromDeck('card-1');
    expect(app.selectedDeckCards).toEqual([]);
  });

  it('should clear all selected cards in one action', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.addCardToDeck('card-1');
    app.addCardToDeck('card-2');
    app.clearSelectedDeckCards();

    expect(app.selectedDeckCards).toEqual([]);
  });
});
