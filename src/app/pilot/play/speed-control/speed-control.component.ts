import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  output,
  OnInit,
  OnDestroy,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-speed-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './speed-control.component.html',
  styles: [],
})
export class SpeedControlComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameStateService);

  readonly validateAnswer = output<void>();
  readonly invalidateAnswer = output<void>();
  readonly triggerNext = output<void>();

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

  protected readonly timerPercent = computed(() => {
    const limit = this.gs.state().timeLimit ?? 30;
    return limit > 0 ? (this.remainingSeconds() / limit) * 100 : 0;
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
