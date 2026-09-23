import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { DeckImportResult, DeckVersion, RiftboundApiService } from './riftbound-api.service';

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
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 2, section: 'MAIN_DECK' }]);

    app.removeCardFromDeck('card-1');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 1, section: 'MAIN_DECK' }]);

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

  it('filters visible cards through the type and domain controls while preserving the deck destination', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.cards = [
      { id: 'legend', name: 'Example Legend', type: 'Legend', cost: null, text: '', setCode: 'OGN', domains: ['Chaos', 'Order'] },
      { id: 'unit', name: 'Example Unit', type: 'Unit', cost: 1, text: '', setCode: 'OGN', domains: ['Mind'] }
    ];
    app.addToSection = 'SIDEBOARD';
    fixture.detectChanges();
    await fixture.whenStable();
    const select = (id: string, value: string) => {
      const element: HTMLSelectElement = fixture.nativeElement.querySelector(id);
      element.value = value;
      element.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    select('#cardType', 'Legend');
    select('#cardDomain', 'Chaos');
    expect(fixture.nativeElement.querySelector('#cardSort')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.card-item').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.card-item').textContent).toContain('Example Legend');
    fixture.nativeElement.querySelector('.card-item').click();
    expect(app.selectedDeckCards).toEqual([{ cardId: 'legend', quantity: 1, section: 'SIDEBOARD' }]);
    select('#cardDomain', 'Mind');
    expect(fixture.nativeElement.querySelectorAll('.card-item').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No cards match');
    select('#cardType', '');
    expect(fixture.nativeElement.querySelector('.card-item').textContent).toContain('Example Unit');
  });

  it('keeps main-deck and sideboard copies independent when adding and removing', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.addCardToDeck('same-card');
    app.addToSection = 'SIDEBOARD';
    app.addCardToDeck('same-card');
    app.addCardToDeck('same-card');
    app.removeCardFromDeck('same-card', 'SIDEBOARD');
    expect(app.selectedDeckCards).toEqual([
      { cardId: 'same-card', quantity: 1, section: 'MAIN_DECK' },
      { cardId: 'same-card', quantity: 1, section: 'SIDEBOARD' }
    ]);
  });

  it('preserves the current draft on import errors and detaches a successful import from saved decks', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.deckId = 'existing-deck';
    app.addCardToDeck('original');
    app.importPreview = { cards: [], errors: [{ line: 2, message: 'Unknown code' }], warnings: [] };
    app.useImportedDeck();
    expect(app.deckId).toBe('existing-deck');
    expect(app.selectedDeckCards[0].cardId).toBe('original');
    app.importPreview = {
      cards: [{ cardId: 'imported', quantity: 6, section: 'RUNES' }], errors: [], warnings: []
    };
    app.useImportedDeck();
    expect(app.deckId).toBeNull();
    expect(app.selectedDeckCards).toEqual([{ cardId: 'imported', quantity: 6, section: 'RUNES' }]);
    expect(app.importStatus).toContain('new draft');
  });

  it('ignores a preview response if the text changed during the request', () => {
    const response = new Subject<DeckImportResult>();
    const api = { ...apiStub, previewImport: () => response.asObservable() };
    const app = new AppComponent(api as unknown as RiftboundApiService);
    app.importText = 'old text';
    app.previewTextImport();
    app.importText = 'new text';
    app.resetImportPreview();
    response.next({ cards: [{ cardId: 'old', quantity: 1 }], errors: [], warnings: [] });
    expect(app.importPreview).toBeNull();
    expect(app.importBusy).toBeFalse();
  });

  it('loads the selected text file into the import editor', async () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const text = 'Runes:\n6 Body Rune [OGN-126]';
    const input = { files: [new File([text], 'deck.txt', { type: 'text/plain' })], value: 'deck.txt' };
    await app.readDeckFile({ target: input } as unknown as Event);
    expect(app.importText).toBe(text);
    expect(app.importPreview).toBeNull();
    expect(input.value).toBe('');
  });

  it('creates an empty deck after an import and immediately clears the selected panel', () => {
    const create = jasmine.createSpy('createDeck').and.returnValue(of({ id: 'empty', name: 'Empty', formatId: 'format-constructed' }));
    const api = { ...apiStub, createDeck: create };
    const app = new AppComponent(api as unknown as RiftboundApiService);
    app.importPreview = { cards: [{ cardId: 'rune', quantity: 12, section: 'RUNES' }], errors: [], warnings: [] };
    app.useImportedDeck();
    app.deckName = 'Empty';
    app.createDeck();
    expect(create).toHaveBeenCalledWith({ name: 'Empty', formatId: 'format-constructed', cards: [] });
    expect(app.deckId).toBe('empty');
    expect(app.selectedDeckCards).toEqual([]);
    expect(app.importStatus).toBe('');
  });

  it('saves an imported selection only through the explicit selection action', () => {
    const create = jasmine.createSpy('createDeck').and.callFake(payload => of({ id: 'saved', name: payload.name, formatId: payload.formatId }));
    const app = new AppComponent({ ...apiStub, createDeck: create } as unknown as RiftboundApiService);
    app.selectedDeckCards = [{ cardId: 'rune', quantity: 6, section: 'RUNES' }];
    app.createDeck(true);
    expect(create.calls.mostRecent().args[0].cards).toEqual([{ cardId: 'rune', quantity: 6, section: 'RUNES' }]);
    expect(app.selectedDeckCards[0].quantity).toBe(6);
  });

  it('shows duplicate-name errors without changing the selected deck', () => {
    const app = new AppComponent({ ...apiStub, createDeck: () => throwError(() => ({ status: 409, error: { error: 'Name already exists.' } })) } as unknown as RiftboundApiService);
    app.deckId = 'existing';
    app.selectedDeckCards = [{ cardId: 'rune', quantity: 6 }];
    app.createDeck();
    expect(app.deckError).toBe('Name already exists.');
    expect(app.deckId).toBe('existing');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'rune', quantity: 6 }]);
    expect(app.creatingDeck).toBeFalse();
  });

  it('ignores a previous deck load that completes after an empty deck is created', () => {
    const versions = new Subject<DeckVersion[]>();
    const app = new AppComponent({ ...apiStub, getDeckVersions: () => versions.asObservable() } as unknown as RiftboundApiService);
    app.loadDeck('previous');
    app.createDeck();
    versions.next([{ id: 'old-version', deckId: 'previous', cards: [{ cardId: 'old', quantity: 5 }] }]);
    expect(app.selectedDeckCards).toEqual([]);
  });
});
