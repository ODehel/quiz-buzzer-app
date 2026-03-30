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
  selector: 'app-mcq-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mcq-control.component.html',
  styles: [],
})
export class McqControlComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameStateService);

  readonly triggerChoices = output<void>();
  readonly triggerCorrection = output<void>();
  readonly triggerNext = output<void>();

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

  protected readonly timerPercent = computed(() => {
    const limit = this.gs.state().timeLimit ?? 30;
    return limit > 0 ? (this.remainingSeconds() / limit) * 100 : 0;
  });

  protected getPipsForChoice(choiceIndex: number): number[] {
    const choice = this.choiceLabels[choiceIndex];
    const answers = this.gs.state().playerAnswers.filter(
      (a) => a.choice === choice
    );
    return new Array(answers.length);
  }

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
