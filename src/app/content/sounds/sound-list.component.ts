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
  styles: [],
  template: `
    <div class="page-header">
      <h1 class="page-title">Jingles</h1>
      <div class="page-actions">
        <button class="btn-primary" (click)="onOpenUpload()" data-testid="btn-upload">
          <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Uploader un jingle
        </button>
      </div>
    </div>

    @if (isLoading()) {
      <div style="text-align:center;padding:48px;color:var(--muted)" data-testid="loading">Chargement…</div>
    } @else if (sounds().length === 0) {
      <div style="text-align:center;padding:48px;color:var(--muted)" data-testid="empty-list">Aucun jingle — uploadez votre premier jingle</div>
    } @else {
      <div class="table-wrap" data-testid="sounds-table">
        <div class="table-header" style="display:grid;grid-template-columns:1fr 150px 100px;padding:10px 16px">
          <span>Nom</span>
          <span>Date d'upload</span>
          <span style="text-align:right">Actions</span>
        </div>
        @for (s of sounds(); track s.id) {
          <div class="table-row" style="display:grid;grid-template-columns:1fr 150px 100px;align-items:center;padding:10px 16px" data-testid="sound-row">
            <span>{{ s.name }}</span>
            <span style="font-size:12px;color:var(--muted)">{{ formatDate(s.created_at) }}</span>
            <div style="text-align:right">
              <button class="btn-icon" style="color:var(--red)" (click)="onDeleteClick(s)" title="Supprimer" data-testid="btn-delete">
                <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
        }
      </div>

      @if (totalPages() > 1) {
        <div style="margin-top:16px">
          <app-paginator
            [page]="currentPage()"
            [total]="totalPages()"
            (pageChange)="onPageChange($event)"
          />
        </div>
      }
    }

    <!-- Upload dialog -->
    @if (dialogOpen()) {
      <div class="modal-overlay" (click)="onCloseDialog()" data-testid="upload-overlay">
        <div class="modal" (click)="$event.stopPropagation()" data-testid="upload-dialog">
          <div class="modal-title">Uploader un jingle</div>
          <div class="modal-body">
            <div class="field" style="margin-bottom:14px">
              <label class="field-label">Fichier audio</label>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                (change)="onFileSelected($event)"
                class="field-input"
                data-testid="input-file"
              />
            </div>
            <div class="field">
              <label class="field-label">Nom du jingle</label>
              <input
                type="text"
                class="field-input"
                [ngModel]="uploadName()"
                (ngModelChange)="uploadName.set($event)"
                data-testid="input-name"
              />
            </div>
            @if (uploadError()) {
              <div class="field-error" style="margin-top:8px" data-testid="upload-error">{{ uploadError() }}</div>
            }
          </div>
          <div class="modal-actions">
            <button class="btn-modal-cancel" (click)="onCloseDialog()" data-testid="btn-cancel">Annuler</button>
            <button
              class="btn-primary"
              [disabled]="!canUpload()"
              (click)="onUpload()"
              data-testid="btn-confirm-upload"
            >Uploader</button>
          </div>
        </div>
      </div>
    }

    @if (toastMessage()) {
      <div class="toast" [class.toast-error]="toastIsError()" data-testid="toast">{{ toastMessage() }}</div>
    }

    <app-confirm-dialog />
  `,
})
export class SoundListComponent {
  private readonly soundService = inject(SoundService);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly sounds = signal<Sound[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);

  protected readonly dialogOpen = signal(false);
  protected readonly uploadName = signal('');
  protected readonly uploadError = signal<string | null>(null);
  private selectedFile: File | null = null;

  protected readonly canUpload = signal(false);

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
