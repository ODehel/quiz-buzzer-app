import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('is hidden by default', () => {
    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeNull();
  });

  it('shows dialog with message when opened', fakeAsync(() => {
    component.open('Voulez-vous supprimer ?');
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeTruthy();
    expect(el.querySelector('.modal-body')!.textContent).toContain('Voulez-vous supprimer ?');
  }));

  it('resolves with true when confirm is clicked', fakeAsync(() => {
    const promise = component.open('Confirm?');
    fixture.detectChanges();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    tick();

    expect(promise).resolves.toBe(true);
  }));

  it('resolves with false when cancel is clicked', fakeAsync(() => {
    const promise = component.open('Cancel?');
    fixture.detectChanges();

    const cancelBtn = el.querySelector('[data-testid="confirm-cancel"]') as HTMLButtonElement;
    cancelBtn.click();
    tick();

    expect(promise).resolves.toBe(false);
  }));

  it('resolves with false when overlay is clicked', fakeAsync(() => {
    const promise = component.open('Overlay?');
    fixture.detectChanges();

    const overlay = el.querySelector('[data-testid="confirm-overlay"]') as HTMLElement;
    overlay.click();
    tick();

    expect(promise).resolves.toBe(false);
  }));

  it('hides dialog after confirmation', fakeAsync(() => {
    component.open('Test');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeTruthy();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    tick();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeNull();
  }));
});
