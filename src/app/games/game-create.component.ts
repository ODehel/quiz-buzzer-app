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
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-game-create',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-create.component.html',
  styles: [],
})
export class GameCreateComponent {
  private readonly gameService = inject(GameService);
  protected readonly toast = inject(ToastService);
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
      this.toast.show('Une partie est déjà en cours', true);
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
          this.toast.show('Erreur lors du chargement des quiz', true);
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
          this.toast.show('Une partie est déjà en cours', true);
          this.showResumeLink.set(true);
          return;
        }
        if (err.status === 404 && err.error?.error === 'QUIZ_NOT_FOUND') {
          // CA-27
          this.toast.show('Le quiz sélectionné n\'existe plus', true);
          this.reloadQuizzes();
          return;
        }
      }
      // CA-28: generic error
      this.toast.show('Erreur lors de la création', true);
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

}
