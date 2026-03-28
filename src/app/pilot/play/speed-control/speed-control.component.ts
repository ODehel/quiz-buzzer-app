import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-speed-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="speed-control" data-testid="speed-control">
      <div class="speed-control__question-info">
        <span class="speed-control__question-number" data-testid="question-number">
          Question {{ (gs.state().questionIndex ?? 0) + 1 }}
          @if (gs.state().totalQuestions) {
            / {{ gs.state().totalQuestions }}
          }
        </span>
      </div>

      <h2 class="speed-control__question-title" data-testid="question-title">
        {{ gs.state().questionTitle }}
      </h2>

      <!-- Timer -->
      @if (gs.status() === 'QUESTION_OPEN' || gs.status() === 'QUESTION_BUZZED') {
        <div class="speed-control__timer" data-testid="timer">
          {{ remainingSeconds() }}s
        </div>
      }

      <!-- QUESTION_BUZZED: show buzzer info -->
      @if (gs.status() === 'QUESTION_BUZZED') {
        <div class="speed-control__buzzer" data-testid="buzzer-info">
          <span class="speed-control__buzzer-name">{{ gs.state().currentBuzzer }}</span>
          <span class="speed-control__buzzer-label">a buzzé !</span>
        </div>

        @if (gs.state().timerEnded) {
          <div class="speed-control__hint" data-testid="timer-hint">
            Temps écoulé — décidez maintenant
          </div>
        }

        <div class="speed-control__actions" data-testid="buzz-actions">
          <button
            class="btn btn--success"
            [disabled]="isWaitingValidation()"
            (click)="onValidateAnswer()"
            data-testid="btn-validate"
          >
            Valider
          </button>
          <button
            class="btn btn--danger"
            [disabled]="isWaitingValidation()"
            (click)="onInvalidateAnswer()"
            data-testid="btn-invalidate"
          >
            Invalider
          </button>
        </div>
      }

      <!-- QUESTION_OPEN: buttons disabled -->
      @if (gs.status() === 'QUESTION_OPEN') {
        <div class="speed-control__actions" data-testid="open-actions">
          <button class="btn btn--success" disabled data-testid="btn-validate">
            Valider
          </button>
          <button class="btn btn--danger" disabled data-testid="btn-invalidate">
            Invalider
          </button>
        </div>
      }

      <!-- QUESTION_CLOSED: results -->
      @if (gs.status() === 'QUESTION_CLOSED') {
        <div class="speed-control__result" data-testid="result-phase">
          @if (speedWinner()) {
            <div class="speed-control__winner" data-testid="winner">
              Gagnant : {{ speedWinner() }}
            </div>
          } @else {
            <div class="speed-control__no-winner" data-testid="no-winner">
              Aucun gagnant
            </div>
          }

          <button
            class="btn btn--primary"
            [disabled]="isWaitingNext()"
            (click)="onTriggerNext()"
            data-testid="btn-next-question"
          >
            Question suivante
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .speed-control { padding: 16px; }
    .speed-control__question-info { margin-bottom: 8px; }
    .speed-control__question-number { font-size: 0.9rem; color: #6c757d; font-weight: 600; }
    .speed-control__question-title { margin: 0 0 16px; font-size: 1.25rem; }
    .speed-control__timer { font-size: 2rem; font-weight: 700; text-align: center; margin: 16px 0; color: #0d6efd; }
    .speed-control__buzzer { text-align: center; margin: 16px 0; padding: 16px; background: #fff3e0; border: 2px solid #fd7e14; border-radius: 8px; }
    .speed-control__buzzer-name { font-size: 1.5rem; font-weight: 700; display: block; color: #e65100; }
    .speed-control__buzzer-label { font-size: 0.9rem; color: #6c757d; }
    .speed-control__hint { text-align: center; color: #dc3545; font-weight: 600; margin: 8px 0; }
    .speed-control__actions { display: flex; gap: 12px; margin-top: 16px; }
    .speed-control__result { margin-top: 16px; }
    .speed-control__winner { text-align: center; padding: 16px; background: #d4edda; border-radius: 8px; font-size: 1.1rem; font-weight: 600; color: #155724; margin-bottom: 16px; }
    .speed-control__no-winner { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 8px; font-size: 1.1rem; color: #6c757d; margin-bottom: 16px; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; flex: 1; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
    .btn--success { background: #28a745; color: #fff; }
    .btn--success:disabled { background: #6c757d; cursor: not-allowed; }
    .btn--danger { background: #dc3545; color: #fff; }
    .btn--danger:disabled { background: #6c757d; cursor: not-allowed; }
  `],
})
export class SpeedControlComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameStateService);

  @Output() readonly validateAnswer = new EventEmitter<void>();
  @Output() readonly invalidateAnswer = new EventEmitter<void>();
  @Output() readonly triggerNext = new EventEmitter<void>();

  protected readonly isWaitingValidation = signal(false);
  protected readonly isWaitingNext = signal(false);
  protected readonly remainingSeconds = signal(0);

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly speedWinner = computed(() => {
    const results = this.gs.state().questionResults;
    if (results.length === 0) return null;
    const lastResult = results[results.length - 1];
    if (lastResult.question_type !== 'SPEED') return null;
    const winner = (lastResult.results as { participant_name: string; winner: boolean }[])
      .find((r) => r.winner);
    return winner?.participant_name ?? null;
  });

  ngOnInit(): void {
    this.startTimerIfNeeded();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  startTimer(startedAt: string, timeLimit: number): void {
    this.stopTimer();
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    this.remainingSeconds.set(Math.max(0, Math.round(timeLimit - elapsed)));
    this.timerInterval = setInterval(() => {
      this.remainingSeconds.update((r) => Math.max(0, r - 1));
    }, 1000);
  }

  onTimerTick(remaining: number): void {
    this.remainingSeconds.set(remaining);
  }

  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  pauseTimer(): void {
    this.stopTimer();
  }

  resumeTimer(remainingSeconds: number): void {
    this.remainingSeconds.set(remainingSeconds);
    this.timerInterval = setInterval(() => {
      this.remainingSeconds.update((r) => Math.max(0, r - 1));
    }, 1000);
  }

  resetWaiting(): void {
    this.isWaitingValidation.set(false);
    this.isWaitingNext.set(false);
  }

  protected onValidateAnswer(): void {
    this.isWaitingValidation.set(true);
    this.validateAnswer.emit();
  }

  protected onInvalidateAnswer(): void {
    this.isWaitingValidation.set(true);
    this.invalidateAnswer.emit();
  }

  protected onTriggerNext(): void {
    this.isWaitingNext.set(true);
    this.triggerNext.emit();
  }

  private startTimerIfNeeded(): void {
    const state = this.gs.state();
    if ((state.status === 'QUESTION_OPEN' || state.status === 'QUESTION_BUZZED') &&
      state.startedAt && state.timeLimit) {
      this.startTimer(state.startedAt, state.timeLimit);
    }
  }
}
