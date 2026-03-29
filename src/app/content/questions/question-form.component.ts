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
import { environment } from '../../../environments/environment';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <a routerLink="/content/questions">Questions</a>
      <span class="breadcrumb-sep">&rsaquo;</span>
      <span>{{ mode() === 'create' ? 'Nouvelle question' : 'Modifier la question' }}</span>
    </div>

    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">{{ mode() === 'create' ? 'Nouvelle question' : 'Modifier la question' }}</h1>
    </div>

    <form (ngSubmit)="onSubmit()" novalidate>
      <div class="form-grid">

        <!-- Left column -->
        <div>

          <!-- General information card -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Informations generales</span>
              <!-- Type toggle [CA-16, CA-17] -->
              @if (mode() === 'create') {
                <div class="type-toggle" data-testid="type-toggle">
                  <button
                    type="button"
                    class="type-btn"
                    [class.active-mcq]="formType() === 'MCQ'"
                    (click)="onTypeChange('MCQ')"
                    data-testid="toggle-mcq"
                  >MCQ</button>
                  <button
                    type="button"
                    class="type-btn"
                    [class.active-speed]="formType() === 'SPEED'"
                    (click)="onTypeChange('SPEED')"
                    data-testid="toggle-speed"
                  >SPEED</button>
                </div>
              } @else {
                <span class="badge-type" [class.badge-mcq]="formType() === 'MCQ'" [class.badge-speed]="formType() === 'SPEED'" data-testid="type-readonly">{{ formType() }}</span>
              }
            </div>
            <div class="card-body">

              <!-- Theme -->
              <div class="field">
                <label class="field-label" for="theme">Theme <span class="required">*</span></label>
                <select
                  id="theme"
                  class="field-select"
                  [ngModel]="formThemeId()"
                  (ngModelChange)="formThemeId.set($event)"
                  [name]="'theme'"
                  data-testid="input-theme"
                >
                  <option value="">-- Choisir un theme --</option>
                  @for (theme of themes(); track theme.id) {
                    <option [value]="theme.id">{{ theme.name }}</option>
                  }
                </select>
                @if (fieldErrors()['theme_id']) {
                  <span class="field-error" data-testid="error-theme">{{ fieldErrors()['theme_id'] }}</span>
                }
              </div>

              <!-- Title -->
              <div class="field">
                <label class="field-label" for="title">Titre de la question <span class="required">*</span></label>
                <input
                  id="title"
                  type="text"
                  class="field-input"
                  [ngModel]="formTitle()"
                  (ngModelChange)="formTitle.set($event)"
                  [name]="'title'"
                  maxlength="200"
                  placeholder="Commencez par une majuscule..."
                  data-testid="input-title"
                />
                <div class="field-hint">10 a 250 caracteres</div>
                @if (fieldErrors()['title']) {
                  <span class="field-error" data-testid="error-title">{{ fieldErrors()['title'] }}</span>
                }
              </div>

            </div>
          </div>

          <!-- MCQ choices card -->
          @if (formType() === 'MCQ') {
            <div class="card" data-testid="mcq-choices">
              <div class="card-header">
                <span class="card-title">Propositions</span>
                <span class="field-hint">Cochez la bonne reponse</span>
              </div>
              <div class="card-body">
                <div class="choices-list">
                  @for (choice of formChoices(); track $index; let i = $index) {
                    <div
                      class="choice-row"
                      [class.correct]="formCorrectAnswer() === formChoices()[i] && formChoices()[i] !== ''"
                    >
                      <input
                        type="radio"
                        class="choice-radio"
                        [name]="'correct'"
                        [checked]="formCorrectAnswer() === formChoices()[i] && formChoices()[i] !== ''"
                        (change)="onCorrectAnswerChange(i)"
                        [attr.data-testid]="'radio-choice-' + i"
                      />
                      <span class="choice-letter">{{ choiceLetters[i] }}</span>
                      <input
                        type="text"
                        class="choice-input"
                        [ngModel]="formChoices()[i]"
                        (ngModelChange)="onChoiceChange(i, $event)"
                        [name]="'choice-' + i"
                        maxlength="40"
                        [placeholder]="'Choix ' + choiceLetters[i] + '...'"
                        [attr.data-testid]="'input-choice-' + i"
                      />
                    </div>
                  }
                </div>
                @if (fieldErrors()['choices']) {
                  <span class="field-error" data-testid="error-choices">{{ fieldErrors()['choices'] }}</span>
                }
                @if (fieldErrors()['correct_answer']) {
                  <span class="field-error" data-testid="error-correct-answer">{{ fieldErrors()['correct_answer'] }}</span>
                }
              </div>
            </div>
          }

          <!-- SPEED answer card -->
          @if (formType() === 'SPEED') {
            <div class="card" data-testid="speed-answer">
              <div class="card-header">
                <span class="card-title">Reponse attendue</span>
              </div>
              <div class="card-body">
                <div class="field">
                  <label class="field-label" for="correct-answer">Reponse <span class="required">*</span></label>
                  <input
                    id="correct-answer"
                    type="text"
                    class="field-input"
                    [ngModel]="formCorrectAnswer()"
                    (ngModelChange)="formCorrectAnswer.set($event)"
                    [name]="'correct_answer'"
                    maxlength="40"
                    data-testid="input-correct-answer"
                  />
                  @if (fieldErrors()['correct_answer']) {
                    <span class="field-error" data-testid="error-correct-answer">{{ fieldErrors()['correct_answer'] }}</span>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Parameters card (sliders) -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Parametres</span>
            </div>
            <div class="card-body">

              <!-- Level slider [CA-23] -->
              <div class="slider-row">
                <div class="slider-header">
                  <label class="field-label">Niveau de difficulte</label>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="level-dots-preview" data-testid="level-visual">
                      @for (dot of [1,2,3,4,5]; track dot) {
                        <div
                          class="ldot"
                          [class.on-1]="dot <= formLevel() && dot === 1"
                          [class.on-2]="dot <= formLevel() && dot === 2"
                          [class.on-3]="dot <= formLevel() && dot === 3"
                          [class.on-4]="dot <= formLevel() && dot === 4"
                          [class.on-5]="dot <= formLevel() && dot === 5"
                        ></div>
                      }
                    </div>
                    <span class="slider-value">{{ formLevel() }}</span>
                  </div>
                </div>
                <input
                  type="range" min="1" max="5" step="1"
                  [ngModel]="formLevel()"
                  (ngModelChange)="formLevel.set($event)"
                  [name]="'level'"
                  data-testid="slider-level"
                />
              </div>

              <!-- Duration slider [CA-24] -->
              <div class="slider-row">
                <div class="slider-header">
                  <label class="field-label">Duree</label>
                  <div>
                    <span class="slider-value">{{ formTimeLimit() }}</span>
                    <span class="slider-unit">secondes</span>
                  </div>
                </div>
                <input
                  type="range" min="5" max="120" step="5"
                  [ngModel]="formTimeLimit()"
                  (ngModelChange)="formTimeLimit.set($event)"
                  [name]="'time_limit'"
                  data-testid="slider-duration"
                />
              </div>

              <!-- Points slider [CA-25] -->
              <div class="slider-row">
                <div class="slider-header">
                  <label class="field-label">Points</label>
                  <div>
                    <span class="slider-value">{{ formPoints() }}</span>
                    <span class="slider-unit">pts</span>
                  </div>
                </div>
                <input
                  type="range" min="50" max="500" step="50"
                  [ngModel]="formPoints()"
                  (ngModelChange)="formPoints.set($event)"
                  [name]="'points'"
                  data-testid="slider-points"
                />
              </div>

            </div>
          </div>

          <!-- Media card [CA-33] -->
          <div class="card" data-testid="media-section">
            <div class="card-header">
              <span class="card-title">Medias</span>
              @if (mode() === 'create') {
                <span class="field-hint" style="color:var(--amber)">Disponibles apres creation</span>
              }
            </div>
            <div class="card-body">

              <!-- Image zone -->
              <div class="field">
                <label class="field-label">Image</label>
                @if (mode() === 'create') {
                  <div class="media-zone" data-testid="drop-image-disabled" title="Sauvegardez d'abord la question pour ajouter des medias">
                    <div class="media-zone-label">Upload desactive (sauvegardez d'abord)</div>
                  </div>
                } @else if (imagePath()) {
                  <div class="media-preview" data-testid="image-preview">
                    <img [src]="imageUrl()" alt="Preview" class="preview-img" />
                    <button
                      type="button"
                      class="btn-ghost"
                      (click)="onDeleteMedia('image')"
                      data-testid="btn-delete-image"
                    >Supprimer</button>
                  </div>
                } @else {
                  <div
                    class="drop-zone"
                    (click)="imageInput.click()"
                    (dragover)="$event.preventDefault()"
                    (drop)="onFileDrop($event, 'image')"
                    data-testid="drop-image"
                  >
                    Glisser-deposer ou cliquer pour ajouter une image
                  </div>
                  <input
                    #imageInput
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    (change)="onFileSelect($event, 'image')"
                    hidden
                    data-testid="file-input-image"
                  />
                }
                @if (fieldErrors()['image']) {
                  <span class="field-error" data-testid="error-image">{{ fieldErrors()['image'] }}</span>
                }
              </div>

              <!-- Audio zone -->
              <div class="field">
                <label class="field-label">Audio</label>
                @if (mode() === 'create') {
                  <div class="media-zone" data-testid="drop-audio-disabled" title="Sauvegardez d'abord la question pour ajouter des medias">
                    <div class="media-zone-label">Upload desactive (sauvegardez d'abord)</div>
                  </div>
                } @else if (audioPath()) {
                  <div class="media-preview" data-testid="audio-preview">
                    <span>Fichier audio present</span>
                    <button
                      type="button"
                      class="btn-ghost"
                      (click)="onDeleteMedia('audio')"
                      data-testid="btn-delete-audio"
                    >Supprimer</button>
                  </div>
                } @else {
                  <div
                    class="drop-zone"
                    (click)="audioInput.click()"
                    (dragover)="$event.preventDefault()"
                    (drop)="onFileDrop($event, 'audio')"
                    data-testid="drop-audio"
                  >
                    Glisser-deposer ou cliquer pour ajouter un audio
                  </div>
                  <input
                    #audioInput
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg"
                    (change)="onFileSelect($event, 'audio')"
                    hidden
                    data-testid="file-input-audio"
                  />
                }
                @if (fieldErrors()['audio']) {
                  <span class="field-error" data-testid="error-audio">{{ fieldErrors()['audio'] }}</span>
                }
              </div>

            </div>
          </div>

        </div><!-- /left column -->

        <!-- Right column -->
        <div class="sidebar-right">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Actions</span>
            </div>
            <div class="card-body">
              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  [disabled]="isSubmitting()"
                  data-testid="btn-submit"
                >
                  {{ mode() === 'create' ? 'Creer la question' : 'Enregistrer les modifications' }}
                </button>
                <button
                  type="button"
                  class="btn-ghost"
                  (click)="onCancel()"
                  data-testid="btn-cancel"
                >Annuler</button>
              </div>
            </div>
          </div>
        </div><!-- /right column -->

      </div>
    </form>

    @if (toastMessage()) {
      <div class="toast" [class.toast-error]="toastIsError()" data-testid="toast">
        {{ toastMessage() }}
      </div>
    }

    @if (isUploading()) {
      <div class="upload-overlay" data-testid="uploading">
        Upload {{ isUploading() }} en cours...
      </div>
    }

    <app-confirm-dialog />
  `,
  styles: [],
})
export class QuestionFormComponent {
  private readonly route = inject(ActivatedRoute);
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
  protected readonly formPoints = signal(200);

  // Media
  protected readonly imagePath = signal<string | null>(null);
  protected readonly audioPath = signal<string | null>(null);

  // UI state
  protected readonly isSubmitting = signal(false);
  protected readonly isUploading = signal<'image' | 'audio' | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);
  protected readonly themes = signal<Theme[]>([]);

  protected readonly choiceLetters = CHOICE_LETTERS;

  protected readonly imageUrl = computed(() => {
    const path = this.imagePath();
    return path ? `${environment.serverUrl}${path}` : null;
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
            this.showToast('Question introuvable', true);
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
      this.showToast('Question creee');
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
      this.showToast('Aucune modification detectee');
      this.router.navigate(['/content/questions']);
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.questionService.patch(this.questionId()!, patch);
      this.showToast('Question mise a jour');
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
      this.showToast('Erreur serveur, reessayez', true);
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
      this.showToast('Erreur lors de l\'upload', true);
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
      this.showToast('Erreur lors de la suppression du media', true);
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

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
