import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { SideboardSwapsComponent } from './sideboard-swaps.component';
import { RiftboundApiService, SideboardPlan } from './riftbound-api.service';

const cards = [{ id: 'u', name: 'Unit', type: 'Unit', cost: 2, text: '', setCode: 'VEN' }, { id: 's', name: 'Spell', type: 'Spell', cost: 3, text: '', setCode: 'VEN' }];
const entries = [{ cardId: 'u', quantity: 39 }, { cardId: 's', quantity: 2, section: 'SIDEBOARD' as const }];
const swap = { outCardId: 'u', inCardId: 's' };
const plan: SideboardPlan = { id: 'plan', name: 'Aggro', baseVersionId: 'v1', swaps: [swap] };

describe('SideboardSwapsComponent', () => {
  let api: jasmine.SpyObj<RiftboundApiService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('api', ['getSideboardPlans', 'saveSideboardPlan', 'deleteSideboardPlan']);
    api.getSideboardPlans.and.returnValue(of([plan]));
    api.saveSideboardPlan.and.returnValue(of(plan));
    api.deleteSideboardPlan.and.returnValue(of({ deleted: true }));
    await TestBed.configureTestingModule({ imports: [SideboardSwapsComponent], providers: [{ provide: RiftboundApiService, useValue: api }] }).compileComponents();
  });
  function setup() {
    const fixture = TestBed.createComponent(SideboardSwapsComponent);
    fixture.componentRef.setInput('deckId', 'deck'); fixture.componentRef.setInput('baseVersionId', 'v1');
    fixture.componentRef.setInput('entries', entries); fixture.componentRef.setInput('catalog', new Map(cards.map(c => [c.id, c])));
    fixture.detectChanges(); return fixture;
  }
  it('stages through controls, applies only explicitly, undoes and restores without saving', async () => {
    const fixture = setup(); await fixture.whenStable();
    const c = fixture.componentInstance;
    const emit = spyOn(c.lineupChange, 'emit');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('details')!.open).toBeFalse();
    const choose = (id: string, value: string) => { const input = el.querySelector<HTMLSelectElement>(id)!; input.value = value; input.dispatchEvent(new Event('change')); fixture.detectChanges(); };
    const click = (text: string) => { Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === text)!.click(); fixture.detectChanges(); };
    choose('#sideboard-out', 'u'); choose('#sideboard-in', 's'); click('Add swap');
    expect(c.pending).toBeTrue(); expect(emit).not.toHaveBeenCalled();
    click('Apply & restart practice'); expect(emit.calls.mostRecent().args[0]!.swapCount).toBe(1);
    click('Undo'); expect(c.pending).toBeTrue(); expect(c.applied.length).toBe(1);
    click('Restore saved lineup'); expect(emit.calls.mostRecent().args[0]).toEqual({ entries, swapCount: 0 });
    expect(c.pending).toBeFalse(); expect(api.saveSideboardPlan).not.toHaveBeenCalled();
  });
  it('loads, saves, updates and deletes plans without applying them automatically', () => {
    const fixture = setup(); const c = fixture.componentInstance; const emit = spyOn(c.lineupChange, 'emit');
    c.selectedPlanId = plan.id; c.loadSelectedPlan();
    expect(c.swaps).toEqual([swap]); expect(emit).not.toHaveBeenCalled();
    c.savePlan(true); expect(api.saveSideboardPlan).toHaveBeenCalledWith('deck', { name: 'Aggro', baseVersionId: 'v1', swaps: [swap] }, 'plan');
    c.planName = 'Control'; c.savePlan();
    expect(api.saveSideboardPlan.calls.mostRecent().args[2]).toBeUndefined();
    spyOn(window, 'confirm').and.returnValue(true); c.deletePlan();
    expect(c.plans).toEqual([]); expect(c.swaps).toEqual([swap]); expect(emit).not.toHaveBeenCalled();
  });
  it('blocks stale plans and keeps drafts on API failure', () => {
    const fixture = setup(); const c = fixture.componentInstance;
    c.baseVersionId = 'v2'; c.selectedPlanId = 'plan'; c.loadSelectedPlan();
    expect(c.stale).toBeTrue(); expect(c.swaps).toEqual([]);
    c.savePlan(true); expect(api.saveSideboardPlan).not.toHaveBeenCalled();
    c.outCardId = 'u'; c.inCardId = 's'; c.stageSwap(); c.planName = 'Test';
    api.saveSideboardPlan.and.returnValue(throwError(() => ({ error: { error: 'The saved deck changed.' } })));
    c.savePlan(); expect(c.swaps).toEqual([swap]); expect(c.planError).toContain('saved deck changed'); expect(c.busy).toBeFalse();
  });
  it('cancels old requests on deck changes and allows temporary swaps if plans fail to load', () => {
    const pending = new Subject<SideboardPlan[]>(); api.getSideboardPlans.and.returnValue(pending);
    const fixture = setup(); const c = fixture.componentInstance;
    api.getSideboardPlans.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentRef.setInput('deckId', 'new'); fixture.detectChanges();
    pending.next([plan]); pending.complete();
    expect(c.plans).toEqual([]); expect(c.planError).toContain('Temporary swaps still work');
    c.outCardId = 'u'; c.inCardId = 's'; c.stageSwap(); c.apply(); expect(c.applied.length).toBe(1);
  });
});
