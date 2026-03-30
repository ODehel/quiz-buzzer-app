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
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <a routerLink="/games">Parties</a>
      <span class="breadcrumb-sep">›</span>
      <span>Nouvelle partie</span>
    </div>

    <div class="page-header">
      <h1 class="page-title">Nouvelle partie</h1>
      <p class="page-sub">Choisissez un quiz et enregistrez les noms des joueurs.</p>
    </div>

    @if (isLoadingQuizzes()) {
      <div class="loading" data-testid="loading">Chargement...</div>
    } @else if (quizzes().length === 0) {
      <div class="empty-quizzes" data-testid="no-quizzes">
        <p>Aucun quiz disponible — créez d'abord un quiz</p>
        <a routerLink="/content/quizzes/new" class="btn-primary">
          Créer un quiz
        </a>
      </div>
    } @else {
      <form (submit)="onSubmit($event)">
        <div class="form-grid">

          <!-- Left column -->
          <div>

            <!-- Quiz selection card [CA-15, CA-16] -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Quiz</span>
              </div>
              <div class="card-body">

                <div class="field">
                  <label class="field-label" for="quiz-select">
                    Sélectionner un quiz <span class="required">*</span>
                  </label>
                  <select
                    id="quiz-select"
                    class="field-select"
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
                </div>

                @if (isLoadingPreview()) {
                  <div class="field-hint" data-testid="preview-loading">Chargement de l'aperçu...</div>
                } @else if (quizPreview()) {
                  <div class="quiz-preview" data-testid="quiz-preview">
                    <div class="preview-name">{{ quizPreview()!.name }}</div>
                    <div class="preview-stats">
                      <div class="preview-stat">
                        <span class="preview-stat-val">{{ quizPreview()!.question_ids.length }}</span>
                        <span class="preview-stat-lbl">questions</span>
                      </div>
                      @if (estimatedMinutes()) {
                        <div class="preview-stat">
                          <span class="preview-stat-val" style="color:var(--green)">~{{ estimatedMinutes() }}</span>
                          <span class="preview-stat-lbl">min estimées</span>
                        </div>
                      }
                    </div>
                    @if (mcqCount() > 0 || speedCount() > 0) {
                      <div class="preview-types">
                        @if (mcqCount() > 0) {
                          <div class="preview-type-chip chip-mcq">
                            <div class="chip-dot"></div>
                            {{ mcqCount() }} MCQ
                          </div>
                        }
                        @if (speedCount() > 0) {
                          <div class="preview-type-chip chip-speed">
                            <div class="chip-dot"></div>
                            {{ speedCount() }} SPEED
                          </div>
                        }
                      </div>
                    }
                    @if (minLevel() !== null && maxLevel() !== null) {
                      <div class="preview-levels">
                        <span>Niveaux :</span>
                        <div class="level-range">
                          @for (lvl of levelRange; track lvl) {
                            <div class="lvl-badge"
                              [class.active-min]="lvl === minLevel()"
                              [class.active-max]="lvl === maxLevel()">
                              {{ lvl }}
                            </div>
                          }
                        </div>
                        <span style="font-size:11px">min {{ minLevel() }} → max {{ maxLevel() }}</span>
                      </div>
                    }
                  </div>
                }

              </div>
            </div>

            <!-- Participants card [CA-18 à CA-22] -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Participants</span>
                <span class="card-counter" data-testid="participant-counter">
                  <strong>{{ participants().length }}</strong> / 10
                </span>
              </div>
              <div class="card-body">
                <div class="participants-list">
                  @for (participant of participants(); track $index; let i = $index) {
                    <div>
                      <div class="participant-row" data-testid="participant-row">
                        <span class="participant-num">{{ i + 1 }}</span>
                        <input
                          type="text"
                          class="participant-input"
                          [class.error]="fieldErrors()['participant_' + i]"
                          placeholder="Nom du participant"
                          [ngModel]="participant"
                          (ngModelChange)="onParticipantChange(i, $event)"
                          [ngModelOptions]="{standalone: true}"
                          maxlength="50"
                          data-testid="participant-input"
                        />
                        <button
                          type="button"
                          class="btn-remove-p"
                          (click)="onRemoveParticipant(i)"
                          [disabled]="participants().length <= 1"
                          data-testid="btn-remove-participant"
                          [title]="participants().length <= 1 ? 'Au moins 1 participant requis' : 'Retirer ce participant'"
                        >
                          &times;
                        </button>
                      </div>
                      @if (fieldErrors()['participant_' + i]) {
                        <div class="field-error" style="margin-left:24px;margin-top:3px" data-testid="field-error">
                          {{ fieldErrors()['participant_' + i] }}
                        </div>
                      }
                    </div>
                  }
                </div>

                @if (participants().length < 10) {
                  <button
                    type="button"
                    class="btn-add-p"
                    (click)="onAddParticipant()"
                    data-testid="btn-add-participant"
                  >
                    + Ajouter un participant
                  </button>
                }

              </div>
            </div>

          </div>

          <!-- Right column (sidebar) -->
          <div class="sidebar-right">

            <!-- Actions card [CA-23, CA-24, CA-25] -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Lancer</span>
              </div>
              <div class="card-body" style="gap:10px">
                <button
                  type="submit"
                  class="btn-primary btn-primary--lg"
                  [disabled]="!isValid() || isSubmitting()"
                  data-testid="btn-submit"
                >
                  @if (isSubmitting()) {
                    Création en cours...
                  } @else {
                    ▶ Créer la partie
                  }
                </button>
                <button type="button" class="btn-ghost-full" routerLink="/games" data-testid="btn-back">
                  Annuler
                </button>
                @if (validationMessage()) {
                  <div class="validation-hint">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {{ validationMessage() }}
                  </div>
                }
              </div>
            </div>

            <!-- Recap card -->
            @if (quizPreview()) {
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Récapitulatif</span>
                </div>
                <div class="card-body recap-body">
                  <div class="recap-rows">
                    <div class="recap-row">
                      <span class="recap-label">Quiz</span>
                      <span class="recap-value">{{ quizPreview()!.name }}</span>
                    </div>
                    <div class="recap-row">
                      <span class="recap-label">Questions</span>
                      <span>{{ quizPreview()!.question_ids.length }}@if (mcqCount() > 0 || speedCount() > 0) {
                        <span> ({{ mcqCount() }} MCQ · {{ speedCount() }} SPEED)</span>
                      }</span>
                    </div>
                    <div class="recap-row">
                      <span class="recap-label">Participants</span>
                      <span>{{ participants().length }} joueurs</span>
                    </div>
                    @if (estimatedMinutes()) {
                      <div class="recap-row">
                        <span class="recap-label">Durée estimée</span>
                        <span>~{{ estimatedMinutes() }} minutes</span>
                      </div>
                    }
                  </div>
                  <div class="recap-divider"></div>
                  <div class="recap-hint">
                    Après création, vous serez redirigé vers le lobby pour attendre la connexion des buzzers.
                  </div>
                </div>
              </div>
            }

          </div>

        </div>
      </form>
    }

    @if (toastMessage()) {
      <div class="toast-error" [class.toast--success]="!toastIsError()" data-testid="toast">
        <div class="toast-error-header">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          {{ toastMessage() }}
        </div>
        @if (showResumeLink()) {
          <a routerLink="/pilot/play" class="toast-link" data-testid="resume-link">
            Reprendre la partie en cours →
          </a>
        }
      </div>
    }
  `,
  styles: [],
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

  protected readonly levelRange = [1, 2, 3, 4, 5];

  protected readonly isValid = computed(() => {
    const ps = this.participants();
    if (this.selectedQuizId() === null) return false;
    if (ps.length < 1) return false;
    if (!ps.every((p) => p.trim().length > 0 && p.trim().length <= 50)) return false;
    const lower = ps.map((p) => p.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) return false;
    return true;
  });

  /** Selected quiz from the list (has question_summary) */
  private readonly selectedQuiz = computed(() => {
    const id = this.selectedQuizId();
    if (!id) return null;
    return this.quizzes().find((q) => q.id === id) ?? null;
  });

  protected readonly mcqCount = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz?.question_summary?.by_level) return 0;
    return Object.values(quiz.question_summary.by_level).reduce(
      (sum, types) => sum + (types['MCQ'] ?? 0), 0
    );
  });

  protected readonly speedCount = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz?.question_summary?.by_level) return 0;
    return Object.values(quiz.question_summary.by_level).reduce(
      (sum, types) => sum + (types['SPEED'] ?? 0), 0
    );
  });

  protected readonly minLevel = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz?.question_summary?.by_level) return null;
    const levels = Object.keys(quiz.question_summary.by_level).map(Number).filter((n) => !isNaN(n));
    return levels.length > 0 ? Math.min(...levels) : null;
  });

  protected readonly maxLevel = computed(() => {
    const quiz = this.selectedQuiz();
    if (!quiz?.question_summary?.by_level) return null;
    const levels = Object.keys(quiz.question_summary.by_level).map(Number).filter((n) => !isNaN(n));
    return levels.length > 0 ? Math.max(...levels) : null;
  });

  protected readonly estimatedMinutes = computed(() => {
    const preview = this.quizPreview();
    if (!preview) return null;
    // ~25s per question on average
    const mins = Math.round(preview.question_ids.length * 25 / 60);
    return mins > 0 ? mins : 1;
  });

  protected readonly validationMessage = computed(() => {
    if (this.selectedQuizId() === null) return 'Sélectionnez un quiz pour continuer.';
    const ps = this.participants();
    if (ps.some((p) => p.trim().length === 0)) return 'Tous les noms doivent être renseignés.';
    const lower = ps.map((p) => p.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) return 'Deux participants portent le même nom.';
    if (!ps.every((p) => p.trim().length <= 50)) return 'Un nom dépasse 50 caractères.';
    return null;
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
