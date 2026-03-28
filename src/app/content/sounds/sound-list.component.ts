import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, EMPTY } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { SoundService } from './sound.service';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import type { Sound } from '../../core/models/sound.models';
import { ALLOWED_SOUND_MIMES, MAX_SOUND_FILE_SIZE } from '../../core/models/sound.models';
import type { PagedResponse } from '../../core/models/api.models';

@Component({
  selector: 'app-sound-list',
  standalone: true,
  imports: [FormsModule, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sound-list">
      <header class="sound-list__header">
        <h1>Jingles</h1>
        <button class="btn btn--primary" (click)="onOpenUpload()" data-testid="btn-upload">
          Uploader un jingle
        </button>
      </header>

      @if (isLoading()) {
        <div class="loading" data-testid="loading">Chargement...</div>
      } @else if (sounds().length === 0) {
        <p class="empty" data-testid="empty-list">Aucun jingle — uploadez votre premier jingle</p>
      } @else {
        <table class="table" data-testid="sounds-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Date d'upload</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of sounds(); track s.id) {
              <tr data-testid="sound-row">
                <td>{{ s.name }}</td>
                <td>{{ formatDate(s.created_at) }}</td>
                <td class="actions">
                  <button
                    class="btn btn--sm btn--danger-icon"
                    (click)="onDeleteClick(s)"
                    title="Supprimer"
                    data-testid="btn-delete"
                  >Supprimer</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        @if (totalPages() > 1) {
          <app-paginator
            [page]="currentPage()"
            [total]="totalPages()"
            (pageChange)="onPageChange($event)"
          />
        }
      }

      @if (dialogOpen()) {
        <div class="overlay" (click)="onCloseDialog()" data-testid="upload-overlay">
          <div class="dialog" (click)="$event.stopPropagation()" data-testid="upload-dialog">
            <h2>Uploader un jingle</h2>

            <label class="field">
              <span class="field__label">Fichier audio</span>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                (change)="onFileSelected($event)"
                data-testid="input-file"
              />
            </label>

            <label class="field">
              <span class="field__label">Nom du jingle</span>
              <input
                type="text"
                [ngModel]="uploadName()"
                (ngModelChange)="uploadName.set($event)"
                data-testid="input-name"
              />
            </label>

            @if (uploadError()) {
              <p class="error-msg" data-testid="upload-error">{{ uploadError() }}</p>
            }

            <div class="dialog__actions">
              <button class="btn btn--secondary" (click)="onCloseDialog()" data-testid="btn-cancel">
                Annuler
              </button>
              <button
                class="btn btn--primary"
                [disabled]="!canUpload()"
                (click)="onUpload()"
                data-testid="btn-confirm-upload"
              >
                Uploader
              </button>
            </div>
          </div>
        </div>
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
    .sound-list { padding: 24px; max-width: 900px; margin: 0 auto; }
    .sound-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .sound-list__header h1 { margin: 0; font-size: 1.5rem; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .table th { font-weight: 600; font-size: 0.85rem; color: #6c757d; }
    .actions { text-align: right; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { opacity: 0.5; cursor: default; }
    .btn--secondary { background: #e9ecef; color: #495057; }
    .btn--sm { padding: 4px 8px; font-size: 0.8rem; }
    .btn--danger-icon { background: #f8d7da; color: #842029; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .empty { text-align: center; padding: 48px; color: #6c757d; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: #fff; border-radius: 8px; padding: 24px; max-width: 460px; width: 90%; }
    .dialog h2 { margin: 0 0 16px; font-size: 1.1rem; }
    .dialog__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .field__label { font-size: 0.8rem; color: #6c757d; }
    .field input[type="text"] { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.9rem; }
    .error-msg { color: #dc3545; font-size: 0.85rem; margin: 4px 0 0; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #198754; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; }
  `],
})
export class SoundListComponent {
  private readonly soundService = inject(SoundService);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly sounds = signal<Sound[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);

  // Upload dialog
  protected readonly dialogOpen = signal(false);
  protected readonly uploadName = signal('');
  protected readonly uploadError = signal<string | null>(null);
  private selectedFile: File | null = null;

  protected readonly canUpload = signal(false);

  // Toast
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          return this.soundService.getAll({ page: this.currentPage(), limit: 20 }).pipe(
            catchError(() => {
              this.isLoading.set(false);
              this.showToast('Erreur lors du chargement', true);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((response: PagedResponse<Sound>) => {
        this.sounds.set(response.data);
        this.totalPages.set(response.total_pages);
        this.currentPage.set(response.page);
        this.isLoading.set(false);
      });

    this.loadTrigger$.next();
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTrigger$.next();
  }

  protected onOpenUpload(): void {
    this.dialogOpen.set(true);
    this.uploadName.set('');
    this.uploadError.set(null);
    this.selectedFile = null;
    this.canUpload.set(false);
  }

  protected onCloseDialog(): void {
    this.dialogOpen.set(false);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    this.uploadError.set(null);

    if (!file) {
      this.canUpload.set(false);
      return;
    }

    if (!ALLOWED_SOUND_MIMES.includes(file.type)) {
      this.uploadError.set('Format invalide. Formats acceptés : MP3, WAV, OGG');
      this.selectedFile = null;
      this.canUpload.set(false);
      return;
    }

    if (file.size > MAX_SOUND_FILE_SIZE) {
      this.uploadError.set('Fichier trop volumineux (max 10 Mo)');
      this.selectedFile = null;
      this.canUpload.set(false);
      return;
    }

    // Pre-fill name with filename without extension
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
    this.uploadName.set(nameWithoutExt);
    this.canUpload.set(true);
  }

  protected async onUpload(): Promise<void> {
    if (!this.selectedFile || !this.uploadName()) return;

    try {
      await this.soundService.upload(this.uploadName(), this.selectedFile);
      this.dialogOpen.set(false);
      this.showToast('Jingle ajouté');
      this.loadTrigger$.next();
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 409 && err.error?.error === 'SOUND_ALREADY_EXISTS') {
          this.uploadError.set('Un jingle porte déjà ce nom');
        } else if (err.status === 413) {
          this.uploadError.set('Fichier trop volumineux');
        } else {
          this.uploadError.set('Erreur lors de l\'upload');
        }
      } else {
        this.uploadError.set('Erreur lors de l\'upload');
      }
    }
  }

  protected async onDeleteClick(sound: Sound): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer le jingle "${sound.name}" ?`
    );
    if (!confirmed) return;

    try {
      await this.soundService.delete(sound.id);
      this.showToast('Jingle supprimé');
      this.loadTrigger$.next();
    } catch {
      this.showToast('Erreur lors de la suppression', true);
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
