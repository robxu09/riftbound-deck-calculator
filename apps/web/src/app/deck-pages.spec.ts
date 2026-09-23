import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { routes } from './app.routes';
import { HomeComponent } from './home.component';
import { BuilderComponent } from './builder.component';
import { AnalysisComponent } from './analysis.component';
import { DeckWorkspace } from './deck-workspace.service';
import { DeckVersion, RiftboundApiService } from './riftbound-api.service';

describe('Deck page workflows', () => {
  const deck = { id: 'saved', name: 'Saved deck', formatId: 'format-constructed' };
  const cards = [{ cardId: 'unit', quantity: 2, section: 'MAIN_DECK' as const }];
  let api: jasmine.SpyObj<RiftboundApiService>;
  let harness: RouterTestingHarness;
  let vm: DeckWorkspace;

  beforeEach(async () => {
    api = jasmine.createSpyObj('api', ['getCards', 'getFormats', 'getDecks', 'getDeck', 'getDeckVersions', 'createDeck', 'addDeckVersion', 'analyzeDeck', 'previewImport', 'deleteDeck']);
    api.getCards.and.returnValue(of([
      { id: 'legend', name: 'Example Legend', type: 'Legend', cost: null, text: '', setCode: 'OGN', domains: ['Chaos', 'Order'] },
      { id: 'unit', name: 'Example Unit', type: 'Unit', cost: 1, text: '', setCode: 'OGN', domains: ['Mind'] }
    ]));
    api.getFormats.and.returnValue(of([{ id: 'format-constructed', name: 'Constructed', maxDeckSize: 40, minDeckSize: 40, cardLimit: 3 }]));
    api.getDecks.and.returnValue(of([deck]));
    api.getDeck.and.returnValue(of(deck));
    api.getDeckVersions.and.returnValue(of([{ id: 'v1', deckId: deck.id, cards }]));
    api.createDeck.and.returnValue(of({ ...deck, id: 'created', name: 'New deck' }));
    api.addDeckVersion.and.returnValue(of({ id: 'v2', deckId: deck.id, cards }));
    api.analyzeDeck.and.returnValue(of({ deckId: deck.id, formatId: deck.formatId, cardCount: 2, uniqueCardCount: 1, manaCurve: { '1': 2 }, summary: 'Saved summary', warnings: ['Example warning'] }));
    api.previewImport.and.returnValue(of({ cards, errors: [], warnings: [] }));
    await TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: RiftboundApiService, useValue: api }] }).compileComponents();
    vm = TestBed.inject(DeckWorkspace);
    harness = await RouterTestingHarness.create();
  });

  it('starts at Home and carries the selected deck into edit and analysis links', async () => {
    const home = await harness.navigateByUrl('/', HomeComponent);
    expect(harness.routeNativeElement?.textContent).toContain('My decks');
    home.selectedDeckId = deck.id;
    harness.detectChanges();
    const links = Array.from(harness.routeNativeElement!.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(links).toContain('/builder/saved');
    expect(links).toContain('/analysis/saved');
    expect(api.getCards).not.toHaveBeenCalled();
  });

  it('creates an empty draft without an API write and saves only explicitly', async () => {
    const page = await harness.navigateByUrl('/builder/new', BuilderComponent);
    expect(vm.deckId).toBeNull();
    expect(vm.selectedDeckCards).toEqual([]);
    expect(vm.dirty).toBeFalse();
    expect(api.createDeck).not.toHaveBeenCalled();
    vm.deckName = 'New deck';
    expect(vm.dirty).toBeTrue();
    api.getDeck.and.returnValue(of({ ...deck, id: 'created', name: 'New deck' }));
    api.getDeckVersions.and.returnValue(of([{ id: 'v-new', deckId: 'created', cards: [] }]));
    vm.createDeck(true);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/builder/created');
    expect(api.createDeck).toHaveBeenCalledWith({ name: 'New deck', formatId: deck.formatId, cards: [] });
    expect(page.vm.dirty).toBeFalse();
  });

  it('uses a compact dropdown for many decks and updates both destination links', async () => {
    const decks = Array.from({ length: 100 }, (_, i) => ({ ...deck, id: `deck-${i}`, name: `Deck ${i}` }));
    api.getDecks.and.returnValue(of(decks));
    const home = await harness.navigateByUrl('/', HomeComponent);
    expect(home.selectedDeckId).toBe('deck-0');
    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#selectedDeck')!;
    expect(select.options.length).toBe(100);
    expect(harness.routeNativeElement!.querySelector('#deckActions')!.hasAttribute('hidden')).toBeTrue();
    select.value = 'deck-99';
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();
    const links = Array.from(harness.routeNativeElement!.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(links).toContain('/builder/deck-99');
    expect(links).toContain('/analysis/deck-99');
    expect(harness.routeNativeElement!.querySelectorAll('.saved-deck-item').length).toBe(0);
  });

  it('confirms deletion by name, waits for success, and selects the next deck', async () => {
    const next = { ...deck, id: 'next', name: 'Next deck' };
    api.getDecks.and.returnValue(of([deck, next]));
    const home = await harness.navigateByUrl('/', HomeComponent);
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    home.removeDeck(deck.id);
    expect(confirm.calls.mostRecent().args[0]).toContain('"Saved deck"');
    expect(confirm.calls.mostRecent().args[0]).toContain('all its saved versions');
    expect(api.deleteDeck).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    const response = new Subject<{ deleted: boolean }>();
    api.deleteDeck.and.returnValue(response);
    home.removeDeck(deck.id);
    expect(home.selectedDeckId).toBe(deck.id);
    expect(vm.actionBusy).toBeTrue();
    response.next({ deleted: true });
    expect(home.selectedDeckId).toBe('next');
    expect(vm.actionBusy).toBeFalse();
    api.deleteDeck.and.returnValue(of({ deleted: true }));
    home.removeDeck('next');
    harness.detectChanges();
    expect(home.selectedDeckId).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('No saved decks yet');
    expect(harness.routeNativeElement!.querySelector('#selectedDeck')).toBeNull();
  });

  it('keeps the selected deck on failed deletion', async () => {
    const home = await harness.navigateByUrl('/', HomeComponent);
    spyOn(window, 'confirm').and.returnValue(true);
    api.deleteDeck.and.returnValue(throwError(() => new Error('offline')));
    home.removeDeck(deck.id);
    expect(home.selectedDeckId).toBe(deck.id);
    expect(vm.actionBusy).toBeFalse();
    expect(vm.actionError).toContain('Unable to delete');
    api.deleteDeck.and.returnValue(of({ deleted: false }));
    home.removeDeck(deck.id);
    expect(vm.savedDecks).toEqual([deck]);
  });

  it('preserves edits and the save action when switching mobile builder views', async () => {
    const page = await harness.navigateByUrl('/builder/saved', BuilderComponent);
    expect(page.mobileTab).toBe('deck');
    const tabs = harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('.builder-tabs button');
    tabs[1].click();
    harness.detectChanges();
    expect(page.mobileTab).toBe('cards');
    vm.addCardToDeck('legend');
    tabs[0].click();
    harness.detectChanges();
    expect(page.mobileTab).toBe('deck');
    expect(vm.selectedDeckCards.length).toBe(2);
    expect(vm.dirty).toBeTrue();
    const save = harness.routeNativeElement!.querySelector<HTMLButtonElement>('.save-row button')!;
    expect(save.textContent).toContain('Save changes');
    expect(save.disabled).toBeFalse();
  });

  it('opens previewed imports in the builder without saving and resets the previous name', async () => {
    const home = await harness.navigateByUrl('/', HomeComponent);
    vm.deckName = 'Previous name';
    vm.importText = 'MainDeck:\n2 Example Unit [UNIT]';
    vm.previewTextImport();
    home.acceptImport();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/builder/new');
    expect(vm.selectedDeckCards).toEqual(cards);
    expect(vm.deckName).toBe('');
    expect(vm.dirty).toBeTrue();
    expect(api.createDeck).not.toHaveBeenCalled();
  });

  it('keeps the preview open for invalid imports', async () => {
    const home = await harness.navigateByUrl('/', HomeComponent);
    vm.importPreview = { cards: [], errors: [{ line: 1, message: 'Unknown card' }], warnings: [] };
    home.acceptImport();
    expect(TestBed.inject(Router).url).toBe('/');
    expect(api.createDeck).not.toHaveBeenCalled();
  });

  it('does not resurrect an imported draft when creating another deck after discarding it', async () => {
    const home = await harness.navigateByUrl('/', HomeComponent);
    vm.importPreview = { cards, errors: [], warnings: [] };
    home.acceptImport();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(vm.selectedDeckCards).toEqual(cards);
    spyOn(window, 'confirm').and.returnValue(true);
    await harness.navigateByUrl('/', HomeComponent);
    await harness.navigateByUrl('/builder/new', BuilderComponent);
    expect(vm.selectedDeckCards).toEqual([]);
    expect(vm.dirty).toBeFalse();
    expect(api.createDeck).not.toHaveBeenCalled();
  });

  it('loads saved decks on direct builder navigation and preserves filter destinations', async () => {
    await harness.navigateByUrl('/builder/saved', BuilderComponent);
    expect(vm.selectedDeckCards).toEqual(cards);
    expect(vm.dirty).toBeFalse();
    vm.addToSection = 'SIDEBOARD';
    const select = (id: string, value: string) => {
      const element = harness.routeNativeElement!.querySelector<HTMLSelectElement>(id)!;
      element.value = value;
      element.dispatchEvent(new Event('change'));
      harness.detectChanges();
    };
    select('#cardType', 'Legend');
    select('#cardDomain', 'Chaos');
    expect(harness.routeNativeElement!.querySelectorAll('.card-item').length).toBe(1);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.card-item')!.click();
    expect(vm.selectedDeckCards).toContain({ cardId: 'legend', quantity: 1, section: 'SIDEBOARD' });
    expect(vm.dirty).toBeTrue();
    select('#cardDomain', 'Mind');
    expect(harness.routeNativeElement!.textContent).toContain('No cards match');
  });

  it('cancels leaving dirty work and discards only when confirmed', async () => {
    const page = await harness.navigateByUrl('/builder/saved', BuilderComponent);
    vm.addCardToDeck('legend');
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/builder/saved');
    expect(vm.selectedDeckCards.length).toBe(2);
    const event = new Event('beforeunload', { cancelable: true });
    page.beforeUnload(event as BeforeUnloadEvent);
    expect(event.defaultPrevented).toBeTrue();
    confirm.and.returnValue(true);
    await harness.navigateByUrl('/', HomeComponent);
    await harness.navigateByUrl('/builder/saved', BuilderComponent);
    expect(vm.selectedDeckCards).toEqual(cards);
    expect(vm.dirty).toBeFalse();
  });

  it('guards changing deck IDs without destroying the builder component', async () => {
    await harness.navigateByUrl('/builder/saved', BuilderComponent);
    vm.addCardToDeck('legend');
    spyOn(window, 'confirm').and.returnValue(false);
    await harness.navigateByUrl('/builder/other');
    expect(TestBed.inject(Router).url).toBe('/builder/saved');
    expect(api.getDeck).toHaveBeenCalledTimes(1);
  });

  it('keeps failed saves dirty and blocks navigation during a pending save', async () => {
    const page = await harness.navigateByUrl('/builder/saved', BuilderComponent);
    vm.addCardToDeck('legend');
    const response = new Subject<DeckVersion>();
    api.addDeckVersion.and.returnValue(response);
    vm.addDeckVersion();
    expect(page.canLeave()).toBeFalse();
    response.error(new Error('offline'));
    expect(vm.busy).toBeFalse();
    expect(vm.dirty).toBeTrue();
    expect(vm.deckError).toContain('Failed to save');
  });

  it('marks successful version saves clean and permits navigation without confirmation', async () => {
    await harness.navigateByUrl('/builder/saved', BuilderComponent);
    vm.addCardToDeck('legend');
    vm.addDeckVersion();
    expect(vm.dirty).toBeFalse();
    const confirm = spyOn(window, 'confirm');
    await harness.navigateByUrl('/', HomeComponent);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('analyzes saved contents independently of a discarded draft', async () => {
    await harness.navigateByUrl('/builder/saved', BuilderComponent);
    vm.addCardToDeck('legend');
    spyOn(window, 'confirm').and.returnValue(true);
    await harness.navigateByUrl('/analysis/saved', AnalysisComponent);
    expect(api.analyzeDeck).toHaveBeenCalledWith({ deckId: 'saved', formatId: deck.formatId, analysisType: 'summary' });
    expect(api.addDeckVersion).not.toHaveBeenCalled();
    expect(harness.routeNativeElement!.textContent).toContain('Total cards: 2');
    expect(harness.routeNativeElement!.textContent).toContain('Example warning');
  });

  it('disables editing after a failed version load and supports retry', async () => {
    api.getDeckVersions.and.returnValue(throwError(() => new Error('offline')));
    const page = await harness.navigateByUrl('/builder/saved', BuilderComponent);
    expect(page.cannotEdit).toBeTrue();
    expect(harness.routeNativeElement!.querySelector('fieldset')!.disabled).toBeTrue();
    api.getDeckVersions.and.returnValue(of([{ id: 'v1', deckId: 'saved', cards }]));
    page.retry();
    expect(page.cannotEdit).toBeFalse();
    expect(vm.selectedDeckCards).toEqual(cards);
  });

  it('shows analysis errors and recovers on retry', async () => {
    api.analyzeDeck.and.returnValue(throwError(() => new Error('offline')));
    const page = await harness.navigateByUrl('/analysis/saved', AnalysisComponent);
    expect(page.error).toContain('Unable to load');
    expect(page.loading).toBeFalse();
    api.analyzeDeck.and.returnValue(of({ deckId: 'saved', formatId: deck.formatId, cardCount: 0, uniqueCardCount: 0, manaCurve: {}, summary: 'Empty', warnings: [] }));
    page.load();
    expect(page.error).toBe('');
    expect(page.analysis?.cardCount).toBe(0);
  });
});
