import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MulliganPracticeComponent } from './mulligan-practice.component';
import { DeckVersion, RiftboundApiService } from './riftbound-api.service';

describe('MulliganPracticeComponent', () => {
  const cards = [{ id: 'unit', name: 'Practice Unit', type: 'Unit', cost: 2, text: 'Card ability', setCode: 'VEN', domains: ['Body'] }];
  const versions: DeckVersion[] = [{ id: 'v1', deckId: 'deck', cards: [{ cardId: 'unit', quantity: 39, section: 'MAIN_DECK' }] }];
  let api: jasmine.SpyObj<RiftboundApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj('api', ['getCards', 'getDeckVersions']);
    api.getCards.and.returnValue(of(cards));
    api.getDeckVersions.and.returnValue(of(versions));
    await TestBed.configureTestingModule({ imports: [MulliganPracticeComponent], providers: [{ provide: RiftboundApiService, useValue: api }] }).compileComponents();
  });

  it('shows the hand, enforces the selection limit, replaces, draws and resets through controls', () => {
    const fixture = TestBed.createComponent(MulliganPracticeComponent);
    fixture.componentRef.setInput('deckId', 'deck');
    fixture.detectChanges();
    const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const click = (text: string) => { buttons().find(button => button.textContent!.trim() === text)!.click(); fixture.detectChanges(); };
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
});
