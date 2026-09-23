import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { DeckWorkspace } from './deck-workspace.service';
import { DeckFileService } from './deck-file.service';
import { DeckImportResult, DeckVersion, RiftboundApiService } from './riftbound-api.service';

describe('DeckWorkspace', () => {
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
      providers: [{ provide: RiftboundApiService, useValue: apiStub }]
    }).compileComponents();
  });

  it('creates the workspace', () => {
    const app = TestBed.inject(DeckWorkspace);
    expect(app).toBeTruthy();
  });

  it('should add and remove cards from the selected deck', () => {
    const app = TestBed.inject(DeckWorkspace);

    app.addCardToDeck('card-1');
    app.addCardToDeck('card-1');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 2, section: 'MAIN_DECK' }]);

    app.removeCardFromDeck('card-1');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'card-1', quantity: 1, section: 'MAIN_DECK' }]);

    app.removeCardFromDeck('card-1');
    expect(app.selectedDeckCards).toEqual([]);
  });

  it('should clear all selected cards in one action', () => {
    const app = TestBed.inject(DeckWorkspace);

    app.addCardToDeck('card-1');
    app.addCardToDeck('card-2');
    app.clearSelectedDeckCards();

    expect(app.selectedDeckCards).toEqual([]);
  });

  it('renames a selected deck without dropping unsaved card edits', () => {
    const deck = { id: 'saved', name: 'Before', formatId: 'format-constructed' };
    const rename = jasmine.createSpy('renameDeck').and.returnValue(of({ ...deck, name: 'After' }));
    const app = new DeckWorkspace({ ...apiStub, renameDeck: rename } as unknown as RiftboundApiService);
    app.deckId = deck.id;
    app.selectedDeckCards = [{ cardId: 'rune', quantity: 6, section: 'RUNES' }];
    app.beginDeckAction(deck, 'rename');
    app.actionName = 'After';
    app.submitDeckAction();
    expect(rename).toHaveBeenCalledWith(deck.id, 'After');
    expect(app.deckName).toBe('After');
    expect(app.selectedDeckCards[0].quantity).toBe(6);
    expect(app.deckAction).toBeNull();
  });

  it('duplicates a saved deck without replacing the current draft', () => {
    const deck = { id: 'saved', name: 'Original', formatId: 'format-constructed' };
    const duplicate = jasmine.createSpy('duplicateDeck').and.returnValue(of({ ...deck, id: 'copy', name: 'Original copy' }));
    const app = new DeckWorkspace({ ...apiStub, duplicateDeck: duplicate } as unknown as RiftboundApiService);
    app.selectedDeckCards = [{ cardId: 'unsaved', quantity: 2 }];
    app.beginDeckAction(deck, 'duplicate');
    app.submitDeckAction();
    expect(duplicate).toHaveBeenCalledWith('saved', 'Original copy');
    expect(app.selectedDeckCards).toEqual([{ cardId: 'unsaved', quantity: 2 }]);
    expect(app.deckId).toBeNull();
  });

  it('keeps the rename form open and displays conflicts', () => {
    const deck = { id: 'saved', name: 'Before', formatId: 'format-constructed' };
    const app = new DeckWorkspace({ ...apiStub, renameDeck: () => throwError(() => ({ error: { error: 'Name already exists.' } })) } as unknown as RiftboundApiService);
    app.beginDeckAction(deck, 'rename');
    app.submitDeckAction();
    expect(app.actionError).toBe('Name already exists.');
    expect(app.deckAction?.deck.id).toBe('saved');
    expect(app.actionBusy).toBeFalse();
  });

  it('downloads exported saved text without using unsaved selections', () => {
    const deck = { id: 'saved', name: 'My deck', formatId: 'format-constructed' };
    const exportDeck = jasmine.createSpy('exportDeck').and.returnValue(of('Legend:\n'));
    const files = jasmine.createSpyObj<DeckFileService>('DeckFileService', ['download']);
    const app = new DeckWorkspace({ ...apiStub, exportDeck } as unknown as RiftboundApiService, files);
    app.selectedDeckCards = [{ cardId: 'unsaved', quantity: 2 }];
    app.exportSavedDeck(deck);
    expect(exportDeck).toHaveBeenCalledWith('saved');
    expect(files.download).toHaveBeenCalledWith('Legend:\n', 'My deck');
    expect(app.selectedDeckCards[0].cardId).toBe('unsaved');
  });

  it('shows export failures instead of downloading an error response', () => {
    const files = jasmine.createSpyObj<DeckFileService>('DeckFileService', ['download']);
    const app = new DeckWorkspace({ ...apiStub, exportDeck: () => throwError(() => ({ error: '{"error":"Unknown card ID"}' })) } as unknown as RiftboundApiService, files);
    app.exportSavedDeck({ id: 'saved', name: 'Bad card', formatId: 'format-constructed' });
    expect(app.actionError).toBe('Unknown card ID');
    expect(files.download).not.toHaveBeenCalled();
    expect(app.actionBusy).toBeFalse();
  });

  it('keeps main-deck and sideboard copies independent when adding and removing', () => {
    const app = TestBed.inject(DeckWorkspace);
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
    const app = TestBed.inject(DeckWorkspace);
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
    const app = new DeckWorkspace(api as unknown as RiftboundApiService);
    app.importText = 'old text';
    app.previewTextImport();
    app.importText = 'new text';
    app.resetImportPreview();
    response.next({ cards: [{ cardId: 'old', quantity: 1 }], errors: [], warnings: [] });
    expect(app.importPreview).toBeNull();
    expect(app.importBusy).toBeFalse();
  });

  it('loads the selected text file into the import editor', async () => {
    const app = TestBed.inject(DeckWorkspace);
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
    const app = new DeckWorkspace(api as unknown as RiftboundApiService);
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
    const app = new DeckWorkspace({ ...apiStub, createDeck: create } as unknown as RiftboundApiService);
    app.selectedDeckCards = [{ cardId: 'rune', quantity: 6, section: 'RUNES' }];
    app.createDeck(true);
    expect(create.calls.mostRecent().args[0].cards).toEqual([{ cardId: 'rune', quantity: 6, section: 'RUNES' }]);
    expect(app.selectedDeckCards[0].quantity).toBe(6);
  });

  it('shows duplicate-name errors without changing the selected deck', () => {
    const app = new DeckWorkspace({ ...apiStub, createDeck: () => throwError(() => ({ status: 409, error: { error: 'Name already exists.' } })) } as unknown as RiftboundApiService);
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
    const app = new DeckWorkspace({ ...apiStub, getDeckVersions: () => versions.asObservable() } as unknown as RiftboundApiService);
    app.loadDeck('previous');
    app.createDeck();
    versions.next([{ id: 'old-version', deckId: 'previous', cards: [{ cardId: 'old', quantity: 5 }] }]);
    expect(app.selectedDeckCards).toEqual([]);
  });
});
