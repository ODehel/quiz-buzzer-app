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
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-sound-list',
  imports: [FormsModule, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './sound-list.component.html',
})
export class SoundListComponent {
  private readonly soundService = inject(SoundService);
  protected readonly toast = inject(ToastService);

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
  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          return this.soundService.getAll({ page: this.currentPage(), limit: 20 }).pipe(
            catchError(() => {
              this.isLoading.set(false);
              this.toast.show('Erreur lors du chargement', true);
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
      this.toast.show('Jingle ajouté');
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
      this.toast.show('Jingle supprimé');
      this.loadTrigger$.next();
    } catch {
      this.toast.show('Erreur lors de la suppression', true);
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
