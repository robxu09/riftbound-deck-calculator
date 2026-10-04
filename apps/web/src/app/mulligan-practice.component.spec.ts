import { SideboardSwapsComponent } from './sideboard-swaps.component';
import { By } from '@angular/platform-browser';
import { OpeningHandOddsComponent } from './opening-hand-odds.component';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MulliganPracticeComponent } from './mulligan-practice.component';
import { DeckVersion, RiftboundApiService } from './riftbound-api.service';

describe('MulliganPracticeComponent', () => {
  const cards = [{ id: 'unit', name: 'Practice Unit', type: 'Unit', cost: 2, text: 'Card ability', setCode: 'VEN', domains: ['Body'] }];
  const versions: DeckVersion[] = [{ id: 'v1', deckId: 'deck', cards: [{ cardId: 'unit', quantity: 39, section: 'MAIN_DECK' }] }];
  let api: jasmine.SpyObj<RiftboundApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj('api', ['getSideboardPlans', 'getCards', 'getDeckVersions']);
    api.getSideboardPlans.and.returnValue(of([]));
    api.getCards.and.returnValue(of(cards));
    api.getDeckVersions.and.returnValue(of(versions));
    await TestBed.configureTestingModule({ imports: [MulliganPracticeComponent], providers: [{ provide: RiftboundApiService, useValue: api }] }).compileComponents();
  });

  it('adjusts points through accessible controls and resets them with practice or a deck change', () => {
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const add = () => { el.querySelector<HTMLButtonElement>('[aria-label="Add one point"]')!.click(); fixture.detectChanges(); };
    const subtract = () => el.querySelector<HTMLButtonElement>('[aria-label="Subtract one point"]')!;
    expect(subtract().disabled).toBeTrue();
    add(); add(); subtract().click(); fixture.detectChanges();
    expect(el.querySelector('.practice-score output')!.textContent).toBe('1');
    fixture.componentInstance.resetPractice(); fixture.detectChanges();
    expect(el.querySelector('.practice-score output')!.textContent).toBe('0');
    expect(subtract().disabled).toBeTrue();
    add(); fixture.componentRef.setInput('deckId', 'another'); fixture.detectChanges();
    expect(el.querySelector('.practice-score output')!.textContent).toBe('0');
    expect(versions[0].cards[0].quantity).toBe(39);
  });

  it('adjusts turns through controls and resets them with practice or a deck change', () => {
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const next = () => { el.querySelector<HTMLButtonElement>('[aria-label="Next turn"]')!.click(); fixture.detectChanges(); };
    const previous = () => el.querySelector<HTMLButtonElement>('[aria-label="Previous turn"]')!;
    expect(previous().disabled).toBeTrue();
    next(); next(); previous().click(); fixture.detectChanges();
    expect(el.querySelector('.practice-turns output')!.textContent).toBe('2');
    expect(fixture.componentInstance.session!.hand.length).toBe(4);
    fixture.componentInstance.resetPractice(); fixture.detectChanges();
    expect(el.querySelector('.practice-turns output')!.textContent).toBe('1');
    expect(previous().disabled).toBeTrue();
    next(); fixture.componentRef.setInput('deckId', 'another'); fixture.detectChanges();
    expect(el.querySelector('.practice-turns output')!.textContent).toBe('1');
  });

  it('shows the hand, enforces the selection limit, replaces, draws and resets through controls', () => {
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck');
    fixture.detectChanges();
    const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const click = (text: string) => { buttons().find(button => button.textContent!.trim() === text)!.click(); fixture.detectChanges(); };
    const opening = fixture.debugElement.query(By.directive(OpeningHandOddsComponent)).componentInstance as OpeningHandOddsComponent;
    opening.filters.type = 'Unit';
    const originalOdds = opening.result;
    let hand = fixture.nativeElement.querySelectorAll('.practice-hand button') as NodeListOf<HTMLButtonElement>;
    expect(hand.length).toBe(4);
    hand[0].click(); hand[1].click(); fixture.detectChanges();
    expect(hand[2].disabled).toBeTrue();
    expect(hand[0].disabled).toBeFalse();
    click('Replace 2 selected');
    expect(fixture.componentInstance.session?.hand.length).toBe(4);
    click('Draw one');
    expect(fixture.componentInstance.session?.hand.length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Last drawn: Practice Unit');
    click('Reset practice');
    expect(fixture.componentInstance.session?.remaining).toBe(35);
    expect(fixture.nativeElement.querySelectorAll('.practice-hand button').length).toBe(4);
    click('Keep all four');
    expect(fixture.componentInstance.session?.choosing).toBeFalse();
    expect(versions[0].cards[0].quantity).toBe(39);
    expect(opening.result).toEqual(originalOdds);
  });

  it('removes hand cards, undoes removal, channels and recycles runes, and resets through controls', () => {
    spyOn(Math, 'random').and.returnValue(0.999);
    const rune = { ...cards[0], id: 'body', name: 'Body Rune', type: 'Rune' };
    api.getCards.and.returnValue(of([...cards, rune]));
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [...versions[0].cards, { cardId: 'body', quantity: 12, section: 'RUNES' }] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const c = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    const click = (label: string) => { Array.from(el.querySelectorAll('button')).find(button => button.textContent?.trim() === label)!.click(); fixture.detectChanges(); };
    const opening = fixture.debugElement.query(By.directive(OpeningHandOddsComponent)).componentInstance as OpeningHandOddsComponent;
    opening.filters.type = 'Unit'; const initialOdds = opening.result;
    expect(el.querySelector('.remove-hand-card')).toBeNull(); expect(el.querySelector('.rune-practice')).toBeNull();
    click('Keep all four'); click('Remove from hand');
    expect(c.session!.hand.length).toBe(3); expect(c.session!.remaining).toBe(35); expect(c.session!.removed.length).toBe(1);
    expect(el.querySelector<HTMLDetailsElement>('.removed-cards')?.open).toBeFalse();
    expect(opening.result).toEqual(initialOdds);
    click('Undo'); expect(c.session!.hand.length).toBe(4); expect(c.session!.removed.length).toBe(0);
    click('Channel 1'); click('Channel 1');
    expect(c.runes!.inPlay.length).toBe(2); expect(c.runes!.remaining).toBe(10);
    expect(el.querySelectorAll('.rune-practice li').length).toBe(1);
    click('Recycle 1'); expect(c.runes!.remaining).toBe(11);
    for (let i = 0; i < 11; i++) click('Channel 1');
    expect(Array.from(el.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Channel 1')!.disabled).toBeTrue();
    click('Remove from hand'); click('Reset practice');
    expect(c.runes!.remaining).toBe(12); expect(c.runes!.inPlay).toEqual([]);
    expect(c.session!.hand.length).toBe(4); expect(c.session!.removed).toEqual([]); expect(c.session!.choosing).toBeTrue();
    expect(opening.result).toEqual(initialOdds);
  });

  it('clears hand removals and rune movements when sideboard lineups are applied or restored', () => {
    api.getCards.and.returnValue(of([...cards, { ...cards[0], id: 'spell', type: 'Spell' }, { ...cards[0], id: 'rune', type: 'Rune' }]));
    const saved = [...versions[0].cards, { cardId: 'spell', quantity: 1, section: 'SIDEBOARD' as const }, { cardId: 'rune', quantity: 12, section: 'RUNES' as const }];
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: saved }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const c = fixture.componentInstance;
    const swaps = fixture.debugElement.query(By.directive(SideboardSwapsComponent)).componentInstance as SideboardSwapsComponent;
    c.session!.confirm(); c.session!.removeFromHand(c.session!.hand[0].copyId); c.runes!.channel(); c.session!.addPoint(); c.session!.nextTurn();
    swaps.outCardId = 'unit'; swaps.inCardId = 'spell'; swaps.stageSwap(); swaps.apply();
    expect(c.session!.removed).toEqual([]); expect(c.runes!.remaining).toBe(12); expect(c.runes!.inPlay).toEqual([]);
    expect(c.session!.points).toBe(0);
    expect(c.session!.turn).toBe(1);
    c.session!.confirm(); c.runes!.channel(); c.session!.addPoint(); c.session!.nextTurn(); swaps.restore();
    expect(c.session!.removed).toEqual([]); expect(c.runes!.remaining).toBe(12); expect(c.swapCount).toBe(0);
    expect(c.session!.points).toBe(0);
    expect(c.session!.turn).toBe(1);
    expect(saved[0].quantity).toBe(39);
  });

  it('keeps main-deck practice available for missing or invalid rune data', () => {
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [...versions[0].cards, { cardId: 'missing', quantity: 12, section: 'RUNES' }] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    expect(fixture.componentInstance.runeError).toContain('missing');
    expect(fixture.componentInstance.session!.hand.length).toBe(4);
    api.getDeckVersions.and.returnValue(of(versions)); fixture.componentInstance.load();
    expect(fixture.componentInstance.runeError).toBe(''); expect(fixture.componentInstance.runes!.total).toBe(0);
  });

  it('keeps opening odds independent of replacements, draws and reset', () => {
    spyOn(Math, 'random').and.returnValue(0.999);
    api.getCards.and.returnValue(of([...cards, { ...cards[0], id: 'spell', type: 'Spell' }]));
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [{ cardId: 'unit', quantity: 3 }, { cardId: 'spell', quantity: 36 }] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const opening = fixture.debugElement.query(By.directive(OpeningHandOddsComponent)).componentInstance as OpeningHandOddsComponent;
    opening.filters.type = 'Unit';
    const before = opening.result;
    expect(before.matches).toBe(3);
    const practice = fixture.componentInstance.session!;
    practice.toggle(practice.hand[0].copyId); practice.confirm(); fixture.detectChanges();
    expect(opening.result).toEqual(before);
    practice.draw(); fixture.detectChanges();
    expect(opening.result).toEqual(before);
    practice.reset(); fixture.detectChanges();
    expect(opening.result).toEqual(before);
  });

  it('uses applied swaps for practice and both odds panels, then restores the saved default', () => {
    api.getCards.and.returnValue(of([...cards, { ...cards[0], id: 'spell', type: 'Spell' }]));
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [...versions[0].cards, { cardId: 'spell', quantity: 2, section: 'SIDEBOARD' }] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    const c = fixture.componentInstance;
    const opening = fixture.debugElement.query(By.directive(OpeningHandOddsComponent)).componentInstance as OpeningHandOddsComponent;
    const swaps = fixture.debugElement.query(By.directive(SideboardSwapsComponent)).componentInstance as SideboardSwapsComponent;
    opening.filters.type = 'Spell'; expect(opening.result.matches).toBe(0);
    c.session!.confirm(); c.session!.draw();
    swaps.outCardId = 'unit'; swaps.inCardId = 'spell'; swaps.stageSwap();
    expect(c.session!.hand.length).toBe(5);
    swaps.apply(); fixture.detectChanges();
    expect(c.session!.hand.length).toBe(4); expect(c.session!.choosing).toBeTrue(); expect(c.session!.draws).toEqual([]);
    expect(opening.result.matches).toBe(1); expect(opening.adjusted).toBeTrue();
    expect(c.session!.matchStatus({ name: '', type: 'Spell', cost: null }, c.catalog)?.totalMatches).toBe(1);
    c.session!.reset(); expect(c.session!.matchStatus({ name: '', type: 'Spell', cost: null }, c.catalog)?.totalMatches).toBe(1);
    swaps.restore(); fixture.detectChanges();
    expect(opening.result.matches).toBe(0); expect(c.swapCount).toBe(0); expect(c.savedEntries[0].quantity).toBe(39);
  });

  it('shows incomplete-deck and missing-card errors instead of inventing cards', () => {
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [{ cardId: 'unit', quantity: 4 }] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('39 Main Deck cards');
    api.getDeckVersions.and.returnValue(of(versions));
    api.getCards.and.returnValue(of([]));
    fixture.componentInstance.load();
    expect(fixture.componentInstance.error).toContain('missing from the catalog');
    expect(fixture.componentInstance.session).toBeNull();
  });

  it('cancels an old deck load when switching decks and recovers from failed requests', () => {
    const pending = new Subject<DeckVersion[]>();
    api.getDeckVersions.and.returnValue(pending);
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'old'); fixture.detectChanges();
    api.getDeckVersions.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentRef.setInput('deckId', 'new'); fixture.detectChanges();
    pending.next(versions); pending.complete();
    expect(fixture.componentInstance.session).toBeNull();
    expect(fixture.componentInstance.error).toContain('Unable to load');
    api.getDeckVersions.and.returnValue(of(versions));
    fixture.componentInstance.load();
    expect(fixture.componentInstance.error).toBe('');
    expect(fixture.componentInstance.session?.hand.length).toBe(4);
    expect(api.getDeckVersions).toHaveBeenCalledWith('new');
  });

  it('combines name, type and cost through the UI and shows zero percent for no matches', async () => {
    spyOn(Math, 'random').and.returnValue(0.999);
    api.getCards.and.returnValue(of([
      ...cards,
      { ...cards[0], id: 'spell', name: 'Practice Spell', type: 'Spell' },
      { ...cards[0], id: 'expensive', name: 'Practice Big Unit', cost: 12 },
      { ...cards[0], id: 'free', name: 'Free Unit', cost: 0 }
    ]));
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [
      { cardId: 'spell', quantity: 4 }, { cardId: 'unit', quantity: 3 },
      { cardId: 'expensive', quantity: 5 }, { cardId: 'spell', quantity: 27 }
    ] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges(); await fixture.whenStable();
    const select = (id: string, label: string) => {
      const element = fixture.nativeElement.querySelector(id) as HTMLSelectElement;
      element.value = Array.from(element.options).find(option => option.text === label)!.value;
      element.dispatchEvent(new Event('change')); fixture.detectChanges();
    };
    select('#probability-type', 'Unit'); select('#probability-cost', '2');
    const input = fixture.nativeElement.querySelector('#probability-name') as HTMLInputElement;
    input.value = 'Practice'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    fixture.componentInstance.drawCount = 1; fixture.detectChanges();
    expect(fixture.componentInstance.probabilitySummary).toContain('8.6%');
    expect(fixture.componentInstance.matchStateSummary).toContain('still in deck: 3');
    select('#probability-cost', '12');
    expect(fixture.componentInstance.probabilitySummary).toContain('14.3%');
    select('#probability-cost', '0');
    expect(fixture.componentInstance.probabilitySummary).toContain('0.0%');
    input.value = 'missing'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(fixture.componentInstance.probabilitySummary).toContain('0.0%');
  });

  it('filters next-draw odds by actual printed keywords through the dropdown', async () => {
    spyOn(Math, 'random').and.returnValue(0.999);
    const hidden = { ...cards[0], text: '[Hidden] (Hide now.)' };
    const other = { ...cards[0], id: 'other', name: 'Hidden supporter', text: 'Play a card with [Hidden].' };
    api.getCards.and.returnValue(of([hidden, other, { ...cards[0], id: 'unused', text: '[Tank]' }]));
    api.getDeckVersions.and.returnValue(of([{ ...versions[0], cards: [
      { cardId: 'other', quantity: 4 }, { cardId: 'unit', quantity: 3 }, { cardId: 'other', quantity: 32 }
    ] }]));
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.detectChanges(); await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const keyword = el.querySelector<HTMLSelectElement>('#probability-keyword')!;
    keyword.value = 'Hidden'; keyword.dispatchEvent(new Event('change'));
    fixture.componentInstance.drawCount = 1; fixture.detectChanges();
    expect(el.querySelector('.probability-panel')!.textContent).toContain('8.6%');
    expect(el.querySelector('.probability-panel')!.textContent).toContain('still in deck: 3');
    fixture.componentInstance.session!.confirm(); fixture.componentInstance.session!.draw(); fixture.detectChanges();
    expect(el.querySelector('.probability-panel')!.textContent).toContain('5.9%');
    keyword.value = 'Tank'; keyword.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(el.querySelector('.probability-panel')!.textContent).toContain('0.0%');
    keyword.value = ''; keyword.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(el.querySelector('.probability-panel')!.textContent).toContain('Choose one or more filters.');
  });
});
