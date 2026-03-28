import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { ThemeService } from './theme.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import type { Theme } from '../../core/models/question.models';

@Component({
  selector: 'app-theme-list',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-list">
      <header class="theme-list__header">
        <h1>Themes <span class="total-badge" data-testid="total-count">{{ total() }}</span></h1>
        @if (!isCreating()) {
          <button class="btn btn--primary" (click)="onOpenCreate()" data-testid="btn-new-theme">
            Nouveau theme
          </button>
        }
      </header>

      @if (isCreating()) {
        <div class="inline-form" data-testid="create-form">
          <input
            #createInput
            type="text"
            class="inline-form__input"
            [class.inline-form__input--error]="createError()"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="onCreateSubmit()"
            (keydown.escape)="onCreateCancel()"
            placeholder="Nom du theme"
            data-testid="input-create"
          />
          <button class="btn btn--primary btn--sm" (click)="onCreateSubmit()" data-testid="btn-create-submit">
            Creer
          </button>
          <button class="btn btn--secondary btn--sm" (click)="onCreateCancel()" data-testid="btn-create-cancel">
            Annuler
          </button>
          @if (createError()) {
            <span class="error-msg" data-testid="create-error">{{ createError() }}</span>
          }
        </div>
      }

      @if (isLoading()) {
        <div class="loading" data-testid="loading">Chargement...</div>
      } @else if (themes().length === 0 && !isCreating()) {
        <p class="empty" data-testid="empty-list">Aucun theme — creez votre premier theme</p>
      } @else if (themes().length > 0) {
        <table class="table" data-testid="themes-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Date de creation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (theme of themes(); track theme.id) {
              <tr data-testid="theme-row">
                @if (editingId() === theme.id) {
                  <td colspan="2">
                    <div class="inline-form">
                      <input
                        #editInput
                        type="text"
                        class="inline-form__input"
                        [class.inline-form__input--error]="editError()"
                        [ngModel]="editingName()"
                        (ngModelChange)="editingName.set($event)"
                        (keydown.enter)="onEditSubmit(theme)"
                        (keydown.escape)="onEditCancel()"
                        data-testid="input-edit"
                      />
                      <button class="btn btn--primary btn--sm" (click)="onEditSubmit(theme)" data-testid="btn-edit-submit">
                        Renommer
                      </button>
                      <button class="btn btn--secondary btn--sm" (click)="onEditCancel()" data-testid="btn-edit-cancel">
                        Annuler
                      </button>
                      @if (editError()) {
                        <span class="error-msg" data-testid="edit-error">{{ editError() }}</span>
                      }
                    </div>
                  </td>
                } @else {
                  <td>
                    <span
                      class="theme-name"
                      (click)="onStartEdit(theme)"
                      data-testid="theme-name"
                    >{{ theme.name }}</span>
                  </td>
                  <td>{{ formatDate(theme.created_at) }}</td>
                }
                <td class="actions">
                  @if (editingId() !== theme.id) {
                    <button
                      class="btn btn--sm btn--icon"
                      (click)="onStartEdit(theme)"
                      title="Renommer"
                      data-testid="btn-edit"
                    >&#9998;</button>
                    <button
                      class="btn btn--sm btn--icon btn--danger-icon"
                      (click)="onDeleteClick(theme)"
                      title="Supprimer"
                      data-testid="btn-delete"
                    >&#128465;</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (toastMessage()) {
        <div class="toast" [class.toast--error]="toastIsError()" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }

      <app-confirm-dialog />
    </div>
  `,
  styles: [`
    .theme-list { padding: 24px; max-width: 900px; margin: 0 auto; }
    .theme-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .theme-list__header h1 { margin: 0; font-size: 1.5rem; }
    .total-badge { font-size: 0.85rem; background: #e9ecef; padding: 2px 8px; border-radius: 12px; color: #6c757d; margin-left: 8px; }
    .inline-form { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .inline-form__input { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.9rem; min-width: 200px; }
    .inline-form__input--error { border-color: #dc3545; }
    .error-msg { color: #dc3545; font-size: 0.85rem; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .table th { font-weight: 600; font-size: 0.85rem; color: #6c757d; }
    .theme-name { cursor: pointer; }
    .theme-name:hover { text-decoration: underline; }
    .actions { text-align: right; white-space: nowrap; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--secondary { background: #e9ecef; color: #495057; }
    .btn--sm { padding: 4px 8px; font-size: 0.8rem; }
    .btn--icon { background: #e9ecef; color: #495057; }
    .btn--danger-icon { background: #f8d7da; color: #842029; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .empty { text-align: center; padding: 48px; color: #6c757d; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #198754; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; }
  `],
})
export class ThemeListComponent {
  private readonly themeService = inject(ThemeService);

  @ViewChild('createInput') createInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('editInput') editInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  // Liste
  protected readonly themes = signal<Theme[]>([]);
  protected readonly total = signal(0);
  protected readonly isLoading = signal(true);

  // Creation
  protected readonly isCreating = signal(false);
  protected readonly newName = signal('');
  protected readonly createError = signal<string | null>(null);

  // Edition
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly editError = signal<string | null>(null);

  // Toast
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

  constructor() {
    this.themeService
      .getAll()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          this.themes.set(res.data);
          this.total.set(res.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.showToast('Erreur lors du chargement', true);
        },
      });
  }

  // --- Creation ---

  protected onOpenCreate(): void {
    this.isCreating.set(true);
    this.newName.set('');
    this.createError.set(null);
    setTimeout(() => this.createInputRef?.nativeElement.focus());
  }

  protected onCreateCancel(): void {
    this.isCreating.set(false);
    this.newName.set('');
    this.createError.set(null);
  }

  protected async onCreateSubmit(): Promise<void> {
    const name = this.newName().trim();
    const validationError = this.validateName(name);
    if (validationError) {
      this.createError.set(validationError);
      return;
    }

    try {
      await this.themeService.create(name);
      this.isCreating.set(false);
      this.newName.set('');
      this.createError.set(null);
      this.showToast('Theme cree');
      this.reload();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_ALREADY_EXISTS'
      ) {
        this.createError.set('Un theme porte deja ce nom');
      } else {
        this.showToast('Erreur lors de la creation', true);
      }
    }
  }

  // --- Edition ---

  protected onStartEdit(theme: Theme): void {
    this.editingId.set(theme.id);
    this.editingName.set(theme.name);
    this.editError.set(null);
    setTimeout(() => this.editInputRef?.nativeElement.focus());
  }

  protected onEditCancel(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editError.set(null);
  }

  protected async onEditSubmit(theme: Theme): Promise<void> {
    const name = this.editingName().trim();
    const validationError = this.validateName(name);
    if (validationError) {
      this.editError.set(validationError);
      return;
    }

    // CA-13: pas d'appel reseau si le nom est identique
    if (name.toLowerCase() === theme.name.toLowerCase()) {
      this.onEditCancel();
      return;
    }

    try {
      await this.themeService.update(theme.id, name);
      this.themes.update((list) =>
        list.map((t) => (t.id === theme.id ? { ...t, name } : t))
      );
      this.editingId.set(null);
      this.editingName.set('');
      this.editError.set(null);
      this.showToast('Theme renomme');
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_ALREADY_EXISTS'
      ) {
        this.editError.set('Un theme porte deja ce nom');
      } else {
        this.showToast('Erreur lors du renommage', true);
      }
    }
  }

  // --- Suppression ---

  protected async onDeleteClick(theme: Theme): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer le theme "${theme.name}" ?`
    );
    if (!confirmed) return;

    try {
      await this.themeService.delete(theme.id);
      // CA-18: suppression locale sans rechargement complet
      this.themes.update((list) => list.filter((t) => t.id !== theme.id));
      this.total.update((n) => n - 1);
      this.showToast('Theme supprime');
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_HAS_QUESTIONS'
      ) {
        this.showToast(
          'Ce theme contient des questions — supprimez-les ou reassignez-les d\'abord',
          true
        );
      } else {
        this.showToast('Erreur lors de la suppression', true);
      }
    }
  }

  // --- Utilitaires ---

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private validateName(name: string): string | null {
    if (!name) return 'Le nom est requis';
    if (name.length < 3 || name.length > 40) return 'Le nom doit contenir entre 3 et 40 caracteres';
    if (name[0] !== name[0].toUpperCase() || name[0] === name[0].toLowerCase()) {
      return 'Le nom doit commencer par une majuscule';
    }
    return null;
  }

  private reload(): void {
    this.themeService.getAll().subscribe({
      next: (res) => {
        this.themes.set(res.data);
        this.total.set(res.total);
      },
    });
  }

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
