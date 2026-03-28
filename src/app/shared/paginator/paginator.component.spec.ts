import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginatorComponent } from './paginator.component';

describe('PaginatorComponent', () => {
  let fixture: ComponentFixture<PaginatorComponent>;
  let component: PaginatorComponent;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PaginatorComponent],
    });
    fixture = TestBed.createComponent(PaginatorComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('renders paginator nav', () => {
    component.page = 1;
    component.total = 5;
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="paginator"]')).toBeTruthy();
  });

  it('displays page buttons within range', () => {
    component.page = 3;
    component.total = 10;
    fixture.detectChanges();

    // Should show pages 1-5 (current - 2 to current + 2)
    expect(el.querySelector('[data-testid="paginator-page-1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="paginator-page-5"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="paginator-page-6"]')).toBeNull();
  });

  it('marks current page as active', () => {
    component.page = 2;
    component.total = 5;
    fixture.detectChanges();

    const btn = el.querySelector('[data-testid="paginator-page-2"]');
    expect(btn!.classList.contains('paginator__btn--active')).toBe(true);
  });

  it('disables prev button on first page', () => {
    component.page = 1;
    component.total = 5;
    fixture.detectChanges();

    const prevBtn = el.querySelector('[data-testid="paginator-prev"]') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('disables next button on last page', () => {
    component.page = 5;
    component.total = 5;
    fixture.detectChanges();

    const nextBtn = el.querySelector('[data-testid="paginator-next"]') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('emits pageChange on page click', () => {
    component.page = 1;
    component.total = 5;
    fixture.detectChanges();

    const spy = jest.fn();
    component.pageChange.subscribe(spy);

    const page3Btn = el.querySelector('[data-testid="paginator-page-3"]') as HTMLButtonElement;
    page3Btn.click();

    expect(spy).toHaveBeenCalledWith(3);
  });

  it('emits pageChange on next click', () => {
    component.page = 2;
    component.total = 5;
    fixture.detectChanges();

    const spy = jest.fn();
    component.pageChange.subscribe(spy);

    const nextBtn = el.querySelector('[data-testid="paginator-next"]') as HTMLButtonElement;
    nextBtn.click();

    expect(spy).toHaveBeenCalledWith(3);
  });

  it('emits pageChange on prev click', () => {
    component.page = 3;
    component.total = 5;
    fixture.detectChanges();

    const spy = jest.fn();
    component.pageChange.subscribe(spy);

    const prevBtn = el.querySelector('[data-testid="paginator-prev"]') as HTMLButtonElement;
    prevBtn.click();

    expect(spy).toHaveBeenCalledWith(2);
  });

  it('does not emit when clicking current page', () => {
    component.page = 2;
    component.total = 5;
    fixture.detectChanges();

    const spy = jest.fn();
    component.pageChange.subscribe(spy);

    const page2Btn = el.querySelector('[data-testid="paginator-page-2"]') as HTMLButtonElement;
    page2Btn.click();

    expect(spy).not.toHaveBeenCalled();
  });
});
