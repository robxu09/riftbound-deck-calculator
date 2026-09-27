import { TestBed } from '@angular/core/testing';
import { DeckCurveComponent } from './deck-curve.component';

describe('DeckCurveComponent', () => {
  it('updates for draft changes, metric selection and scope selection', async () => {
    await TestBed.configureTestingModule({ imports: [DeckCurveComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DeckCurveComponent);
    fixture.componentRef.setInput('catalog', [{ id: 'u', name: 'Unit', type: 'Unit', cost: 2, power: 1, text: '', setCode: 'OGN' }]);
    fixture.componentRef.setInput('entries', [{ cardId: 'u', quantity: 3 }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.curve-counts')?.textContent).toContain('Unit: 3');
    expect(el.querySelector('.curve-row strong')?.textContent).toBe('2');
    const metric = el.querySelector<HTMLSelectElement>('#curveMetric')!;
    metric.value = 'power';
    metric.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.curve-row strong')?.textContent).toBe('1');
    fixture.componentRef.setInput('entries', [{ cardId: 'u', quantity: 1 }]);
    fixture.detectChanges();
    expect(el.querySelector('.curve-counts')?.textContent).toContain('Unit: 1');
    const scope = el.querySelector<HTMLSelectElement>('#curveScope')!;
    scope.value = 'sideboard';
    scope.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.textContent).toContain('No cards in this section.');
    expect(el.querySelectorAll('.curve-row').length).toBe(0);
  });
});
