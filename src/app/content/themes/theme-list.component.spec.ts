import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ThemeListComponent } from './theme-list.component';
import { ThemeService } from './theme.service';
import type { Theme } from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_THEMES: Theme[] = [
  { id: 't1', name: 'Culture', created_at: '2026-03-20T10:00:00Z' },
  { id: 't2', name: 'Sport', created_at: '2026-03-18T08:00:00Z' },
];

function createPagedResponse(themes: Theme[]): PagedResponse<Theme> {
  return {
    data: themes,
    page: 1,
    limit: 100,
    total: themes.length,
    total_pages: 1,
  };
}

describe('ThemeListComponent', () => {
  let fixture: ComponentFixture<ThemeListComponent>;
  let component: ThemeListComponent;
  let el: HTMLElement;
  let mockThemeService: {
    getAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  function setup(themes: Theme[] = MOCK_THEMES) {
    mockThemeService = {
      getAll: jest.fn().mockReturnValue(of(createPagedResponse(themes))),
      create: jest.fn().mockResolvedValue({ id: 't3', name: 'Musique', created_at: '2026-03-28T12:00:00Z' }),
      update: jest.fn().mockResolvedValue({ id: 't1', name: 'Culture generale', created_at: '2026-03-20T10:00:00Z' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [ThemeListComponent],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
      ],
    });

    fixture = TestBed.createComponent(ThemeListComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  // --- Chargement de la liste (CA-1, CA-2, CA-3, CA-4) ---

  it('CA-1: calls GET /api/v1/themes on load', () => {
    setup();
    expect(mockThemeService.getAll).toHaveBeenCalled();
  });

  it('CA-2: displays theme name and creation date for each row', () => {
    setup();
    const rows = el.querySelectorAll('[data-testid="theme-row"]');
    expect(rows.length).toBe(2);

    const firstRow = rows[0];
    expect(firstRow.querySelector('[data-testid="theme-name"]')!.textContent).toContain('Culture');
    expect(firstRow.textContent).toContain('20/03/2026');
  });

  it('CA-3: displays total theme count in header', () => {
    setup();
    expect(el.querySelector('[data-testid="total-count"]')!.textContent).toContain('2');
  });

  it('CA-4: displays invitation message when list is empty', () => {
    setup([]);
    const emptyMsg = el.querySelector('[data-testid="empty-list"]');
    expect(emptyMsg).toBeTruthy();
    expect(emptyMsg!.textContent).toContain('Aucun theme');
    expect(emptyMsg!.textContent).toContain('creez votre premier theme');
  });

  // --- Creation (CA-5, CA-6, CA-7, CA-8, CA-9, CA-10) ---

  it('CA-5: "Nouveau theme" button opens inline input', () => {
    setup();
    expect(el.querySelector('[data-testid="create-form"]')).toBeNull();

    const btn = el.querySelector('[data-testid="btn-new-theme"]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-form"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="input-create"]')).toBeTruthy();
  });

  it('CA-6: shows error for empty name', () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-error"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="create-error"]')!.textContent).toContain('requis');
    expect(mockThemeService.create).not.toHaveBeenCalled();
  });

  it('CA-6: shows error when name does not start with uppercase', () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('culture');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-error"]')!.textContent).toContain('majuscule');
    expect(mockThemeService.create).not.toHaveBeenCalled();
  });

  it('CA-6: shows error when name is too short (< 3 chars)', () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('Ab');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-error"]')!.textContent).toContain('entre 3 et 40');
    expect(mockThemeService.create).not.toHaveBeenCalled();
  });

  it('CA-6: shows error when name is too long (> 40 chars)', () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('A' + 'a'.repeat(40));
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-error"]')!.textContent).toContain('entre 3 et 40');
    expect(mockThemeService.create).not.toHaveBeenCalled();
  });

  it('CA-7: on valid create, calls service and shows toast', async () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('Musique');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockThemeService.create).toHaveBeenCalledWith('Musique');
    expect((component as any).isCreating()).toBe(false);
    expect(el.querySelector('[data-testid="toast"]')!.textContent).toContain('Theme cree');
  });

  it('CA-8: on 409 THEME_ALREADY_EXISTS, shows inline error', async () => {
    setup();
    mockThemeService.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { error: 'THEME_ALREADY_EXISTS' },
      })
    );

    (component as any).isCreating.set(true);
    (component as any).newName.set('Culture');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-create-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="create-error"]')!.textContent).toContain('porte deja ce nom');
    expect((component as any).isCreating()).toBe(true);
  });

  it('CA-9: Escape closes create form without network call', () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('Test');
    fixture.detectChanges();

    const input = el.querySelector('[data-testid="input-create"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect((component as any).isCreating()).toBe(false);
    expect(mockThemeService.create).not.toHaveBeenCalled();
  });

  it('CA-10: Enter submits the create form', async () => {
    setup();
    (component as any).isCreating.set(true);
    (component as any).newName.set('Musique');
    fixture.detectChanges();

    const input = el.querySelector('[data-testid="input-create"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockThemeService.create).toHaveBeenCalledWith('Musique');
  });

  // --- Renommage (CA-11, CA-12, CA-13, CA-14, CA-15, CA-16) ---

  it('CA-11: clicking theme name enters edit mode with pre-filled value', () => {
    setup();
    const nameEl = el.querySelector('[data-testid="theme-name"]') as HTMLElement;
    nameEl.click();
    fixture.detectChanges();

    const editInput = el.querySelector('[data-testid="input-edit"]') as HTMLInputElement;
    expect(editInput).toBeTruthy();
    expect((component as any).editingName()).toBe('Culture');
  });

  it('CA-11: clicking pencil button enters edit mode', () => {
    setup();
    const editBtn = el.querySelector('[data-testid="btn-edit"]') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="input-edit"]')).toBeTruthy();
  });

  it('CA-12: same validation rules apply in edit mode', () => {
    setup();
    (component as any).editingId.set('t1');
    (component as any).editingName.set('cu');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-edit-submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="edit-error"]')!.textContent).toContain('entre 3 et 40');
    expect(mockThemeService.update).not.toHaveBeenCalled();
  });

  it('CA-13: no network call when name is identical (exact match)', async () => {
    setup();
    (component as any).editingId.set('t1');
    (component as any).editingName.set('Culture');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-edit-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockThemeService.update).not.toHaveBeenCalled();
    expect((component as any).editingId()).toBeNull();
  });

  it('CA-13: no network call when name differs only in case', async () => {
    setup();
    (component as any).editingId.set('t1');
    (component as any).editingName.set('CULTURE');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-edit-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockThemeService.update).not.toHaveBeenCalled();
    expect((component as any).editingId()).toBeNull();
  });

  it('CA-14: on valid rename, updates locally and shows toast', async () => {
    setup();
    (component as any).editingId.set('t1');
    (component as any).editingName.set('Culture generale');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-edit-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockThemeService.update).toHaveBeenCalledWith('t1', 'Culture generale');
    expect((component as any).themes()[0].name).toBe('Culture generale');
    expect(el.querySelector('[data-testid="toast"]')!.textContent).toContain('Theme renomme');
  });

  it('CA-15: on 409 in edit mode, shows inline error and stays in edit', async () => {
    setup();
    mockThemeService.update.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { error: 'THEME_ALREADY_EXISTS' },
      })
    );

    (component as any).editingId.set('t1');
    (component as any).editingName.set('Sport');
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="btn-edit-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="edit-error"]')!.textContent).toContain('porte deja ce nom');
    expect((component as any).editingId()).toBe('t1');
  });

  it('CA-16: Escape cancels edit and restores original name', () => {
    setup();
    (component as any).editingId.set('t1');
    (component as any).editingName.set('Modified');
    fixture.detectChanges();

    const input = el.querySelector('[data-testid="input-edit"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect((component as any).editingId()).toBeNull();
    expect((component as any).themes()[0].name).toBe('Culture');
    expect(mockThemeService.update).not.toHaveBeenCalled();
  });

  // --- Suppression (CA-17, CA-18, CA-19) ---

  it('CA-17: delete button opens confirm dialog with theme name', fakeAsync(() => {
    setup();
    const deleteBtn = el.querySelector('[data-testid="btn-delete"]') as HTMLButtonElement;
    deleteBtn.click();
    fixture.detectChanges();
    tick();

    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeTruthy();
    expect(el.querySelector('.dialog__message')!.textContent).toContain('Culture');
  }));

  it('CA-18: after confirmation, removes row locally and shows toast', async () => {
    setup();
    const theme = MOCK_THEMES[0];

    const deletePromise = (component as any).onDeleteClick(theme);
    fixture.detectChanges();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    await deletePromise;
    fixture.detectChanges();

    expect(mockThemeService.delete).toHaveBeenCalledWith('t1');
    expect((component as any).themes().length).toBe(1);
    expect((component as any).total()).toBe(1);
    expect(el.querySelector('[data-testid="toast"]')!.textContent).toContain('Theme supprime');
  });

  it('CA-19: on 409 THEME_HAS_QUESTIONS, shows error toast', async () => {
    setup();
    mockThemeService.delete.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { error: 'THEME_HAS_QUESTIONS' },
      })
    );

    const theme = MOCK_THEMES[0];
    const deletePromise = (component as any).onDeleteClick(theme);
    fixture.detectChanges();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    await deletePromise;
    fixture.detectChanges();

    const toast = el.querySelector('[data-testid="toast"]');
    expect(toast).toBeTruthy();
    expect(toast!.textContent).toContain('contient des questions');
    expect(toast!.classList.contains('toast--error')).toBe(true);
    // La liste n'a pas change
    expect((component as any).themes().length).toBe(2);
  });

  it('CA-17: cancelling delete does not call service', fakeAsync(() => {
    setup();
    const theme = MOCK_THEMES[0];
    (component as any).onDeleteClick(theme);
    fixture.detectChanges();
    tick();

    const cancelBtn = el.querySelector('[data-testid="confirm-cancel"]') as HTMLButtonElement;
    cancelBtn.click();
    tick();
    fixture.detectChanges();

    expect(mockThemeService.delete).not.toHaveBeenCalled();
    expect((component as any).themes().length).toBe(2);
  }));
});
