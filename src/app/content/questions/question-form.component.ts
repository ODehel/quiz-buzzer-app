import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { QuestionService } from './question.service';
import { ThemeService } from '../themes/theme.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import type {
  Question,
  Theme,
  CreateQuestionDto,
  PatchQuestionDto,
} from '../../core/models/question.models';
import type { QuestionType } from '../../core/models/websocket.models';
import { ToastService } from '../../core/services/toast.service';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

@Component({
  selector: 'app-question-form',
  imports: [FormsModule, RouterLink, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-form.component.html',
  styles: [],
})
export class QuestionFormComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly questionService = inject(QuestionService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  // Mode
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly questionId = signal<string | null>(null);
  private originalQuestion: Question | null = null;

  // Form data
  protected readonly formType = signal<QuestionType>('MCQ');
  protected readonly formThemeId = signal('');
  protected readonly formTitle = signal('');
  protected readonly formChoices = signal<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  protected readonly formCorrectAnswer = signal('');
  protected readonly formLevel = signal(3);
  protected readonly formTimeLimit = signal(30);
  protected readonly formPoints = signal(10);

  // Media
  protected readonly imagePath = signal<string | null>(null);
  protected readonly audioPath = signal<string | null>(null);

  // UI state
  protected readonly isSubmitting = signal(false);
  protected readonly isUploading = signal<'image' | 'audio' | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});  protected readonly themes = signal<Theme[]>([]);

  protected readonly choiceLetters = CHOICE_LETTERS;

  protected readonly imageUrl = computed(() => {
    const path = this.imagePath();
    return this.questionService.getMediaUrl(path);
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mode.set('edit');
      this.questionId.set(id);
      this.loadEditData(id);
    } else {
      this.mode.set('create');
      this.loadThemes();
    }
  }

  private loadThemes(): void {
    this.themeService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.themes.set(res.data),
      });
  }

  private loadEditData(id: string): void {
    forkJoin({
      question: this.questionService.getById(id),
      themes: this.themeService.getAll(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ question, themes }) => {
          this.themes.set(themes.data);
          this.populateForm(question);
          this.originalQuestion = question;
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.toast.show('Question introuvable', true);
            this.router.navigate(['/content/questions']);
          }
        },
      });
  }

  private populateForm(q: Question): void {
    this.formType.set(q.type);
    this.formThemeId.set(q.theme_id);
    this.formTitle.set(q.title);
    if (q.choices) {
      this.formChoices.set([...q.choices]);
    }
    this.formCorrectAnswer.set(q.correct_answer);
    this.formLevel.set(q.level);
    this.formTimeLimit.set(q.time_limit);
    this.formPoints.set(q.points);
    this.imagePath.set(q.image_path);
    this.audioPath.set(q.audio_path);
  }

  protected onTypeChange(type: QuestionType): void {
    this.formType.set(type);
    this.formCorrectAnswer.set('');
    this.formChoices.set(['', '', '', '']);
    this.clearFieldErrors();
  }

  protected onChoiceChange(index: number, value: string): void {
    const choices = [...this.formChoices()] as [string, string, string, string];
    const oldValue = choices[index];
    choices[index] = value;
    this.formChoices.set(choices);
    // CA-21: if the radio was on this choice, update correct_answer
    if (this.formCorrectAnswer() === oldValue) {
      this.formCorrectAnswer.set(value);
    }
  }

  protected onCorrectAnswerChange(index: number): void {
    this.formCorrectAnswer.set(this.formChoices()[index]);
  }

  protected async onSubmit(): Promise<void> {
    this.clearFieldErrors();
    if (!this.validate()) return;

    if (this.mode() === 'create') {
      await this.submitCreate();
    } else {
      await this.submitEdit();
    }
  }

  private async submitCreate(): Promise<void> {
    const dto: CreateQuestionDto = {
      type: this.formType(),
      theme_id: this.formThemeId(),
      title: this.formTitle(),
      correct_answer: this.formCorrectAnswer(),
      level: this.formLevel(),
      time_limit: this.formTimeLimit(),
      points: this.formPoints(),
    };
    if (this.formType() === 'MCQ') {
      dto.choices = [...this.formChoices()] as [string, string, string, string];
    }

    this.isSubmitting.set(true);
    try {
      await this.questionService.create(dto);
      this.toast.show('Question creee');
      this.router.navigate(['/content/questions']);
    } catch (err) {
      this.handleSubmitError(err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async submitEdit(): Promise<void> {
    const patch = this.buildPatchPayload();

    if (Object.keys(patch).length === 0) {
      this.toast.show('Aucune modification detectee');
      this.router.navigate(['/content/questions']);
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.questionService.patch(this.questionId()!, patch);
      this.toast.show('Question mise a jour');
      this.router.navigate(['/content/questions']);
    } catch (err) {
      this.handleSubmitError(err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private handleSubmitError(err: unknown): void {
    if (
      err instanceof HttpErrorResponse &&
      err.status === 409 &&
      err.error?.error === 'QUESTION_ALREADY_EXISTS'
    ) {
      this.fieldErrors.update((e) => ({
        ...e,
        title: 'Ce titre existe deja',
      }));
    } else {
      this.toast.show('Erreur serveur, reessayez', true);
    }
  }

  private buildPatchPayload(): PatchQuestionDto {
    const original = this.originalQuestion!;
    const patch: PatchQuestionDto = {};

    if (this.formTitle() !== original.title) patch.title = this.formTitle();
    if (this.formThemeId() !== original.theme_id)
      patch.theme_id = this.formThemeId();
    if (this.formLevel() !== original.level) patch.level = this.formLevel();
    if (this.formTimeLimit() !== original.time_limit)
      patch.time_limit = this.formTimeLimit();
    if (this.formPoints() !== original.points)
      patch.points = this.formPoints();
    if (this.formCorrectAnswer() !== original.correct_answer)
      patch.correct_answer = this.formCorrectAnswer();

    if (this.formType() === 'MCQ') {
      const choicesChanged = this.formChoices().some(
        (c, i) => c !== original.choices?.[i]
      );
      if (choicesChanged)
        patch.choices = [...this.formChoices()] as [
          string,
          string,
          string,
          string,
        ];
    }

    return patch;
  }

  private validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this.formThemeId()) {
      errors['theme_id'] = 'Le theme est obligatoire';
    }
    if (!this.formTitle().trim()) {
      errors['title'] = 'Le titre est obligatoire';
    }

    if (this.formType() === 'MCQ') {
      const choices = this.formChoices();
      const hasEmpty = choices.some((c) => !c.trim());
      if (hasEmpty) {
        errors['choices'] = 'Tous les choix sont obligatoires';
      } else {
        const lower = choices.map((c) => c.trim().toLowerCase());
        const unique = new Set(lower);
        if (unique.size !== 4) {
          errors['choices'] = 'Les choix doivent etre uniques';
        }
      }
      if (!this.formCorrectAnswer() || !choices.includes(this.formCorrectAnswer())) {
        errors['correct_answer'] = 'Selectionnez la bonne reponse';
      }
    } else {
      if (!this.formCorrectAnswer().trim()) {
        errors['correct_answer'] = 'La reponse est obligatoire';
      } else if (this.formCorrectAnswer().length > 40) {
        errors['correct_answer'] = 'Maximum 40 caracteres';
      }
    }

    this.fieldErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  // --- Media ---

  protected async onFileSelect(
    event: Event,
    type: 'image' | 'audio'
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.uploadFile(file, type);
    }
    input.value = '';
  }

  protected async onFileDrop(
    event: DragEvent,
    type: 'image' | 'audio'
  ): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      await this.uploadFile(file, type);
    }
  }

  private async uploadFile(
    file: File,
    type: 'image' | 'audio'
  ): Promise<void> {
    this.clearFieldError(type);

    if (file.size > MAX_FILE_SIZE) {
      this.fieldErrors.update((e) => ({
        ...e,
        [type]: 'Fichier trop volumineux (max 10 Mo)',
      }));
      return;
    }

    const accepted =
      type === 'image' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_AUDIO_TYPES;
    if (!accepted.includes(file.type)) {
      this.fieldErrors.update((e) => ({
        ...e,
        [type]: 'Type non accepte',
      }));
      return;
    }

    this.isUploading.set(type);
    try {
      const result = await this.questionService.uploadMedia(
        this.questionId()!,
        type,
        file
      );
      this.imagePath.set(result.image_path);
      this.audioPath.set(result.audio_path);
    } catch {
      this.toast.show('Erreur lors de l\'upload', true);
    } finally {
      this.isUploading.set(null);
    }
  }

  protected async onDeleteMedia(type: 'image' | 'audio'): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer ${type === 'image' ? 'l\'image' : 'l\'audio'} ?`
    );
    if (!confirmed) return;

    try {
      await this.questionService.deleteMedia(this.questionId()!, type);
      if (type === 'image') {
        this.imagePath.set(null);
      } else {
        this.audioPath.set(null);
      }
    } catch {
      this.toast.show('Erreur lors de la suppression du media', true);
    }
  }

  protected onCancel(): void {
    this.router.navigate(['/content/questions']);
  }

  private clearFieldErrors(): void {
    this.fieldErrors.set({});
  }

  private clearFieldError(key: string): void {
    this.fieldErrors.update((e) => {
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
  }
}
