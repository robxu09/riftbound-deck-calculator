import { TestBed } from '@angular/core/testing';
import { OpeningHandOddsComponent } from './opening-hand-odds.component';

describe('OpeningHandOddsComponent', () => {
  it('combines controls and updates thresholds and deck inputs', async () => {
    await TestBed.configureTestingModule({ imports: [OpeningHandOddsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OpeningHandOddsComponent);
    const unit = { id: 'u', name: 'Scout', type: 'Unit', cost: 2, text: '[Hidden] (Hide now.)', setCode: 'VEN' };
    fixture.componentRef.setInput('catalog', new Map([['u', unit], ['s', { ...unit, id: 's', type: 'Spell', name: 'Other', text: 'Play a card with [Hidden].' }]]));
    fixture.componentRef.setInput('entries', [{ cardId: 'u', quantity: 1 }, { cardId: 's', quantity: 38 }]);
    fixture.detectChanges(); await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Choose one or more filters.');
    const keyword = el.querySelector<HTMLSelectElement>('#opening-keyword')!;
    keyword.value = 'Hidden'; keyword.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(el.textContent).toContain('10.3%');
    expect(el.textContent).toContain('1 matching copies / 39');
    expect(Array.from(keyword.options).map(option => option.text)).toEqual(['Any keyword', 'Hidden']);
    const type = el.querySelector<HTMLSelectElement>('#opening-type')!;
    type.value = 'Unit'; type.dispatchEvent(new Event('change'));
    const name = el.querySelector<HTMLInputElement>('#opening-name')!;
    name.value = 'scout'; name.dispatchEvent(new Event('input'));
    const cost = el.querySelector<HTMLSelectElement>('#opening-cost')!;
    cost.value = Array.from(cost.options).find(option => option.text === '2')!.value;
    cost.dispatchEvent(new Event('change'));
    const comparison = el.querySelector<HTMLSelectElement>('#opening-comparison')!;
    comparison.value = 'atMost'; comparison.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.textContent).toContain('10.3%');
    expect(el.textContent).toContain('1 matching copies / 39');
    const minimum = el.querySelector<HTMLSelectElement>('#opening-minimum')!;
    minimum.value = minimum.options[1].value; minimum.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.textContent).toContain('0.0%');
    fixture.componentRef.setInput('entries', [{ cardId: 'u', quantity: 39 }]);
    fixture.detectChanges();
    expect(el.textContent).toContain('100.0%');
  });
});
