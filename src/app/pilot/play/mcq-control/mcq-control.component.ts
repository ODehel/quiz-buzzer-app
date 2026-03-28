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
  selector: 'app-mcq-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mcq-control" data-testid="mcq-control">
      <!-- QUESTION_TITLE state -->
      @if (gs.status() === 'QUESTION_TITLE') {
        <div class="mcq-control__title-phase" data-testid="title-phase">
          <div class="mcq-control__question-info">
            <span class="mcq-control__question-number" data-testid="question-number">
              Question {{ (gs.state().questionIndex ?? 0) + 1 }}
              @if (gs.state().totalQuestions) {
                / {{ gs.state().totalQuestions }}
              }
            </span>
            <span class="mcq-control__time-limit" data-testid="time-limit">
              {{ gs.state().timeLimit }}s
            </span>
          </div>
          <h2 class="mcq-control__question-title" data-testid="question-title">
            {{ gs.state().questionTitle }}
          </h2>
          <button
            class="btn btn--primary"
            [disabled]="isWaitingChoices()"
            (click)="onTriggerChoices()"
            data-testid="btn-trigger-choices"
          >
            Afficher les choix
          </button>
        </div>
      }

      <!-- QUESTION_OPEN state -->
      @if (gs.status() === 'QUESTION_OPEN') {
        <div class="mcq-control__open-phase" data-testid="open-phase">
          <div class="mcq-control__question-info">
            <span class="mcq-control__question-number" data-testid="question-number">
              Question {{ (gs.state().questionIndex ?? 0) + 1 }}
              @if (gs.state().totalQuestions) {
                / {{ gs.state().totalQuestions }}
              }
            </span>
          </div>
          <h2 class="mcq-control__question-title" data-testid="question-title">
            {{ gs.state().questionTitle }}
          </h2>

          <div class="mcq-control__timer" data-testid="timer">
            {{ remainingSeconds() }}s
          </div>

          <div class="mcq-control__choices" data-testid="choices">
            @for (choice of gs.state().choices; track $index; let i = $index) {
              <div class="mcq-control__choice" data-testid="choice">
                <span class="mcq-control__choice-label">{{ choiceLabels[i] }}</span>
                {{ choice }}
              </div>
            }
          </div>

          <button
            class="btn btn--primary"
            [disabled]="!gs.canCorrect() || isWaitingCorrection()"
            (click)="onTriggerCorrection()"
            data-testid="btn-trigger-correction"
          >
            Corriger
          </button>
        </div>
      }

      <!-- QUESTION_CLOSED state -->
      @if (gs.status() === 'QUESTION_CLOSED') {
        <div class="mcq-control__closed-phase" data-testid="closed-phase">
          <div class="mcq-control__question-info">
            <span class="mcq-control__question-number" data-testid="question-number">
              Question {{ (gs.state().questionIndex ?? 0) + 1 }}
              @if (gs.state().totalQuestions) {
                / {{ gs.state().totalQuestions }}
              }
            </span>
          </div>
          <h2 class="mcq-control__question-title" data-testid="question-title">
            {{ gs.state().questionTitle }}
          </h2>

          <div class="mcq-control__choices" data-testid="choices">
            @for (choice of gs.state().choices; track $index; let i = $index) {
              <div
                class="mcq-control__choice"
                [class.mcq-control__choice--correct]="choice === lastCorrectAnswer()"
                [class.mcq-control__choice--wrong]="choice !== lastCorrectAnswer()"
                data-testid="choice-result"
              >
                <span class="mcq-control__choice-label">{{ choiceLabels[i] }}</span>
                {{ choice }}
              </div>
            }
          </div>

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
    .mcq-control { padding: 16px; }
    .mcq-control__question-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .mcq-control__question-number { font-size: 0.9rem; color: #6c757d; font-weight: 600; }
    .mcq-control__time-limit { font-size: 0.85rem; color: #6c757d; }
    .mcq-control__question-title { margin: 0 0 16px; font-size: 1.25rem; }
    .mcq-control__timer { font-size: 2rem; font-weight: 700; text-align: center; margin: 16px 0; color: #0d6efd; }
    .mcq-control__choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .mcq-control__choice { padding: 12px 16px; border: 2px solid #dee2e6; border-radius: 8px; font-size: 0.95rem; }
    .mcq-control__choice-label { font-weight: 700; margin-right: 8px; }
    .mcq-control__choice--correct { border-color: #28a745; background: #d4edda; }
    .mcq-control__choice--wrong { border-color: #dee2e6; background: #f8f9fa; color: #6c757d; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; width: 100%; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
  `],
})
export class McqControlComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameStateService);

  @Output() readonly triggerChoices = new EventEmitter<void>();
  @Output() readonly triggerCorrection = new EventEmitter<void>();
  @Output() readonly triggerNext = new EventEmitter<void>();

  protected readonly choiceLabels = ['A', 'B', 'C', 'D'];
  protected readonly isWaitingChoices = signal(false);
  protected readonly isWaitingCorrection = signal(false);
  protected readonly isWaitingNext = signal(false);
  protected readonly remainingSeconds = signal(0);

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly lastCorrectAnswer = computed(() => {
    const results = this.gs.state().questionResults;
    if (results.length === 0) return null;
    return results[results.length - 1].correct_answer;
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

  resetWaiting(): void {
    this.isWaitingChoices.set(false);
    this.isWaitingCorrection.set(false);
    this.isWaitingNext.set(false);
  }

  protected onTriggerChoices(): void {
    this.isWaitingChoices.set(true);
    this.triggerChoices.emit();
  }

  protected onTriggerCorrection(): void {
    this.isWaitingCorrection.set(true);
    this.triggerCorrection.emit();
  }

  protected onTriggerNext(): void {
    this.isWaitingNext.set(true);
    this.triggerNext.emit();
  }

  private startTimerIfNeeded(): void {
    const state = this.gs.state();
    if (state.status === 'QUESTION_OPEN' && state.startedAt && state.timeLimit) {
      this.startTimer(state.startedAt, state.timeLimit);
    }
  }
}
