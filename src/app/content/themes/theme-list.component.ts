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
  imports: [FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './theme-list.component.html',
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
