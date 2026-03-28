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
  styles: [],
  template: `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Thèmes <span class="badge badge-open" style="font-size:12px;vertical-align:middle;margin-left:8px" data-testid="total-count">{{ total() }}</span></h1>
      </div>
      @if (!isCreating()) {
        <div class="page-actions">
          <button class="btn-primary" (click)="onOpenCreate()" data-testid="btn-new-theme">
            <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Nouveau thème
          </button>
        </div>
      }
    </div>

    @if (isCreating()) {
      <div class="card" style="margin-bottom:16px" data-testid="create-form">
        <div class="card-body" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input
            #createInput
            type="text"
            class="field-input"
            [class.field-input--error]="createError()"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="onCreateSubmit()"
            (keydown.escape)="onCreateCancel()"
            placeholder="Nom du thème"
            style="min-width:220px;flex:1"
            data-testid="input-create"
          />
          <button class="btn-primary" (click)="onCreateSubmit()" data-testid="btn-create-submit">Créer</button>
          <button class="btn-ghost" (click)="onCreateCancel()" data-testid="btn-create-cancel">Annuler</button>
          @if (createError()) {
            <span class="field-error" data-testid="create-error">{{ createError() }}</span>
          }
        </div>
      </div>
    }

    @if (isLoading()) {
      <div style="text-align:center;padding:48px;color:var(--muted)" data-testid="loading">Chargement…</div>
    } @else if (themes().length === 0 && !isCreating()) {
      <div style="text-align:center;padding:48px;color:var(--muted)" data-testid="empty-list">Aucun thème — créez votre premier thème</div>
    } @else if (themes().length > 0) {
      <div class="table-wrap" data-testid="themes-table">
        <div class="table-header" style="display:grid;grid-template-columns:1fr 150px 80px;padding:10px 16px">
          <span>Nom</span>
          <span>Date de création</span>
          <span style="text-align:right">Actions</span>
        </div>
        @for (theme of themes(); track theme.id) {
          <div class="table-row" style="display:grid;grid-template-columns:1fr 150px 80px;align-items:center;padding:10px 16px" data-testid="theme-row">
            @if (editingId() === theme.id) {
              <div style="grid-column:1/3;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <input
                  #editInput
                  type="text"
                  class="field-input"
                  [class.field-input--error]="editError()"
                  [ngModel]="editingName()"
                  (ngModelChange)="editingName.set($event)"
                  (keydown.enter)="onEditSubmit(theme)"
                  (keydown.escape)="onEditCancel()"
                  style="min-width:200px;flex:1"
                  data-testid="input-edit"
                />
                <button class="btn-primary" style="padding:6px 12px;font-size:12px" (click)="onEditSubmit(theme)" data-testid="btn-edit-submit">Renommer</button>
                <button class="btn-ghost" style="padding:6px 12px;font-size:12px" (click)="onEditCancel()" data-testid="btn-edit-cancel">Annuler</button>
                @if (editError()) {
                  <span class="field-error" data-testid="edit-error">{{ editError() }}</span>
                }
              </div>
            } @else {
              <span style="cursor:pointer" (click)="onStartEdit(theme)" data-testid="theme-name">{{ theme.name }}</span>
              <span style="font-size:12px;color:var(--muted)">{{ formatDate(theme.created_at) }}</span>
            }
            <div style="text-align:right;display:flex;gap:4px;justify-content:flex-end">
              @if (editingId() !== theme.id) {
                <button class="btn-icon" (click)="onStartEdit(theme)" title="Renommer" data-testid="btn-edit">
                  <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="btn-icon" style="color:var(--red)" (click)="onDeleteClick(theme)" title="Supprimer" data-testid="btn-delete">
                  <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (toastMessage()) {
      <div class="toast" [class.toast-error]="toastIsError()" data-testid="toast">{{ toastMessage() }}</div>
    }

    <app-confirm-dialog />
  `,
})
export class ThemeListComponent {
  private readonly themeService = inject(ThemeService);

  @ViewChild('createInput') createInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('editInput') editInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly themes = signal<Theme[]>([]);
  protected readonly total = signal(0);
  protected readonly isLoading = signal(true);

  protected readonly isCreating = signal(false);
  protected readonly newName = signal('');
  protected readonly createError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly editError = signal<string | null>(null);

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
      this.showToast('Thème créé');
      this.reload();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_ALREADY_EXISTS'
      ) {
        this.createError.set('Un thème porte déjà ce nom');
      } else {
        this.showToast('Erreur lors de la création', true);
      }
    }
  }

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
      this.showToast('Thème renommé');
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_ALREADY_EXISTS'
      ) {
        this.editError.set('Un thème porte déjà ce nom');
      } else {
        this.showToast('Erreur lors du renommage', true);
      }
    }
  }

  protected async onDeleteClick(theme: Theme): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer le thème "${theme.name}" ?`
    );
    if (!confirmed) return;

    try {
      await this.themeService.delete(theme.id);
      this.themes.update((list) => list.filter((t) => t.id !== theme.id));
      this.total.update((n) => n - 1);
      this.showToast('Thème supprimé');
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'THEME_HAS_QUESTIONS'
      ) {
        this.showToast(
          'Ce thème contient des questions — supprimez-les ou réassignez-les d\'abord',
          true
        );
      } else {
        this.showToast('Erreur lors de la suppression', true);
      }
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private validateName(name: string): string | null {
    if (!name) return 'Le nom est requis';
    if (name.length < 3 || name.length > 40) return 'Le nom doit contenir entre 3 et 40 caractères';
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
