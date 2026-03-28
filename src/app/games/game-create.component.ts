import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { GameService } from './game.service';
import { QuizService } from '../content/quizzes/quiz.service';
import { GameStateService } from '../core/services/game-state.service';
import type { Quiz, QuizDetail } from '../core/models/quiz.models';

@Component({
  selector: 'app-game-create',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="game-create">
      <header class="game-create__header">
        <h1>Nouvelle partie</h1>
        <a routerLink="/games" class="btn btn--secondary" data-testid="btn-back">
          Retour
        </a>
      </header>

      @if (isLoadingQuizzes()) {
        <div class="loading" data-testid="loading">Chargement...</div>
      } @else if (quizzes().length === 0) {
        <div class="empty-quizzes" data-testid="no-quizzes">
          <p>Aucun quiz disponible — créez d'abord un quiz</p>
          <a routerLink="/content/quizzes/new" class="btn btn--primary">
            Créer un quiz
          </a>
        </div>
      } @else {
        <form (submit)="onSubmit($event)">
          <!-- Quiz selection -->
          <section class="form-section">
            <label class="form-label" for="quiz-select">Quiz</label>
            <select
              id="quiz-select"
              class="form-select"
              [ngModel]="selectedQuizId()"
              (ngModelChange)="onQuizSelect($event)"
              name="quiz"
              data-testid="quiz-select"
            >
              <option [ngValue]="null" disabled>— Sélectionner un quiz —</option>
              @for (quiz of quizzes(); track quiz.id) {
                <option [ngValue]="quiz.id">{{ quiz.name }}</option>
              }
            </select>

            @if (isLoadingPreview()) {
              <div class="preview loading-sm" data-testid="preview-loading">Chargement de l'aperçu...</div>
            } @else if (quizPreview()) {
              <div class="preview" data-testid="quiz-preview">
                <span>{{ quizPreview()!.question_ids.length }} questions</span>
                <span>{{ previewSummary() }}</span>
              </div>
            }
          </section>

          <!-- Participants -->
          <section class="form-section">
            <label class="form-label">
              Participants <span class="counter" data-testid="participant-counter">{{ participants().length }} / 10</span>
            </label>

            @for (participant of participants(); track $index; let i = $index) {
              <div class="participant-row" data-testid="participant-row">
                <input
                  type="text"
                  class="form-input"
                  [class.form-input--error]="fieldErrors()['participant_' + i]"
                  placeholder="Nom du participant"
                  [ngModel]="participant"
                  (ngModelChange)="onParticipantChange(i, $event)"
                  [ngModelOptions]="{standalone: true}"
                  maxlength="50"
                  data-testid="participant-input"
                />
                <button
                  type="button"
                  class="btn btn--icon btn--remove"
                  (click)="onRemoveParticipant(i)"
                  [disabled]="participants().length <= 1"
                  data-testid="btn-remove-participant"
                >
                  &times;
                </button>
                @if (fieldErrors()['participant_' + i]) {
                  <span class="field-error" data-testid="field-error">
                    {{ fieldErrors()['participant_' + i] }}
                  </span>
                }
              </div>
            }

            @if (participants().length < 10) {
              <button
                type="button"
                class="btn btn--secondary btn--sm"
                (click)="onAddParticipant()"
                data-testid="btn-add-participant"
              >
                + Ajouter
              </button>
            }
          </section>

          <!-- Submit -->
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn--primary"
              [disabled]="!isValid() || isSubmitting()"
              data-testid="btn-submit"
            >
              @if (isSubmitting()) {
                Création en cours...
              } @else {
                Créer la partie
              }
            </button>
          </div>
        </form>
      }

      @if (toastMessage()) {
        <div class="toast" [class.toast--error]="toastIsError()" data-testid="toast">
          {{ toastMessage() }}
          @if (showResumeLink()) {
            <a routerLink="/pilot/play" class="toast__link" data-testid="resume-link">
              Reprendre la partie
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .game-create { padding: 24px; max-width: 640px; margin: 0 auto; }
    .game-create__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .game-create__header h1 { margin: 0; font-size: 1.5rem; }
    .form-section { margin-bottom: 24px; }
    .form-label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem; }
    .form-select { width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9rem; }
    .form-input { flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9rem; }
    .form-input--error { border-color: #dc3545; }
    .preview { margin-top: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; font-size: 0.85rem; color: #495057; display: flex; gap: 12px; }
    .loading-sm { font-size: 0.85rem; color: #6c757d; }
    .counter { font-size: 0.8rem; color: #6c757d; font-weight: 400; }
    .participant-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; }
    .field-error { width: 100%; font-size: 0.8rem; color: #dc3545; margin-top: 2px; }
    .form-actions { margin-top: 24px; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
    .btn--secondary { background: #e9ecef; color: #495057; }
    .btn--sm { padding: 4px 12px; font-size: 0.8rem; }
    .btn--icon { background: #e9ecef; color: #495057; padding: 8px 12px; }
    .btn--remove:disabled { opacity: 0.4; cursor: not-allowed; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .empty-quizzes { text-align: center; padding: 48px; }
    .empty-quizzes p { color: #6c757d; margin-bottom: 16px; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #198754; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; }
    .toast__link { color: #fff; text-decoration: underline; margin-left: 8px; }
  `],
})
export class GameCreateComponent {
  private readonly gameService = inject(GameService);
  private readonly quizService = inject(QuizService);
  private readonly gs = inject(GameStateService);
  private readonly router = inject(Router);

  protected readonly quizzes = signal<Quiz[]>([]);
  protected readonly isLoadingQuizzes = signal(true);
  protected readonly selectedQuizId = signal<string | null>(null);
  protected readonly quizPreview = signal<QuizDetail | null>(null);
  protected readonly isLoadingPreview = signal(false);
  protected readonly participants = signal<string[]>(['']);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly isSubmitting = signal(false);
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);
  protected readonly showResumeLink = signal(false);

  protected readonly isValid = computed(() => {
    const ps = this.participants();
    if (this.selectedQuizId() === null) return false;
    if (ps.length < 1) return false;
    if (!ps.every((p) => p.trim().length > 0 && p.trim().length <= 50)) return false;
    const lower = ps.map((p) => p.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) return false;
    return true;
  });

  protected readonly previewSummary = computed(() => {
    const preview = this.quizPreview();
    if (!preview) return '';
    // QuizDetail doesn't have question_summary, so we just show question count
    return `${preview.question_ids.length} questions`;
  });

  constructor() {
    // CA-14: defensive redirect if piloting
    if (this.gs.isPiloting()) {
      this.showToast('Une partie est déjà en cours', true);
      this.router.navigate(['/pilot/play']);
      return;
    }

    // CA-13: load quizzes
    this.quizService
      .getAll({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (response) => {
          this.quizzes.set(response.data);
          this.isLoadingQuizzes.set(false);
        },
        error: () => {
          this.isLoadingQuizzes.set(false);
          this.showToast('Erreur lors du chargement des quiz', true);
        },
      });
  }

  protected onQuizSelect(quizId: string): void {
    this.selectedQuizId.set(quizId);
    this.quizPreview.set(null);

    if (!quizId) return;

    // CA-16: load preview
    this.isLoadingPreview.set(true);
    this.quizService.getById(quizId).subscribe({
      next: (detail) => {
        this.quizPreview.set(detail);
        this.isLoadingPreview.set(false);
      },
      error: () => {
        this.isLoadingPreview.set(false);
      },
    });
  }

  protected onParticipantChange(index: number, value: string): void {
    const updated = [...this.participants()];
    updated[index] = value;
    this.participants.set(updated);
    this.validateParticipants();
  }

  protected onAddParticipant(): void {
    if (this.participants().length >= 10) return;
    this.participants.set([...this.participants(), '']);
  }

  protected onRemoveParticipant(index: number): void {
    if (this.participants().length <= 1) return;
    const updated = this.participants().filter((_, i) => i !== index);
    this.participants.set(updated);
    this.validateParticipants();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.isValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      // CA-24: create game
      const game = await this.gameService.create({
        quiz_id: this.selectedQuizId()!,
        participants: this.participants().map((p) => p.trim()),
      });

      // CA-25: update state and navigate to lobby
      this.gs.initFromGame(game);
      this.router.navigate(['/pilot/lobby']);
    } catch (err) {
      this.isSubmitting.set(false);

      if (err instanceof HttpErrorResponse) {
        if (err.status === 409 && err.error?.error === 'ACTIVE_GAME_EXISTS') {
          // CA-26
          this.showToast('Une partie est déjà en cours', true);
          this.showResumeLink.set(true);
          return;
        }
        if (err.status === 404 && err.error?.error === 'QUIZ_NOT_FOUND') {
          // CA-27
          this.showToast('Le quiz sélectionné n\'existe plus', true);
          this.reloadQuizzes();
          return;
        }
      }
      // CA-28: generic error
      this.showToast('Erreur lors de la création', true);
    }
  }

  private validateParticipants(): void {
    const errors: Record<string, string> = {};
    const ps = this.participants();

    ps.forEach((p, i) => {
      const trimmed = p.trim();
      if (trimmed.length === 0 && p.length > 0) {
        errors[`participant_${i}`] = 'Le nom ne peut pas être vide';
      } else if (trimmed.length > 50) {
        errors[`participant_${i}`] = 'Le nom ne doit pas dépasser 50 caractères';
      } else if (trimmed.length > 0) {
        // Check uniqueness (case-insensitive)
        const lower = trimmed.toLowerCase();
        const isDuplicate = ps.some(
          (other, j) => j !== i && other.trim().toLowerCase() === lower
        );
        if (isDuplicate) {
          errors[`participant_${i}`] = 'Ce nom est déjà utilisé';
        }
      }
    });

    this.fieldErrors.set(errors);
  }

  private reloadQuizzes(): void {
    this.isLoadingQuizzes.set(true);
    this.selectedQuizId.set(null);
    this.quizPreview.set(null);
    this.quizService.getAll({ page: 1, limit: 100 }).subscribe({
      next: (response) => {
        this.quizzes.set(response.data);
        this.isLoadingQuizzes.set(false);
      },
      error: () => {
        this.isLoadingQuizzes.set(false);
      },
    });
  }

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    this.showResumeLink.set(false);
    setTimeout(() => {
      this.toastMessage.set(null);
      this.showResumeLink.set(false);
    }, 4000);
  }
}
