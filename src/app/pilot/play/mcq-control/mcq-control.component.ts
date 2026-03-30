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
  template: `
    <div data-testid="mcq-control" class="flex-col gap-4">
      <!-- Question meta -->
      <div class="flex items-center gap-2 text-muted" style="font-size:11px">
        <span class="display-num badge-mcq"
          style="font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid #2a4a8a"
          [style.background]="gs.status() === 'QUESTION_CLOSED' ? 'var(--green-dim)' : ''"
          [style.color]="gs.status() === 'QUESTION_CLOSED' ? 'var(--green)' : 'var(--accent)'"
          [style.border-color]="gs.status() === 'QUESTION_CLOSED' ? 'var(--green-border)' : ''"
          data-testid="question-number">
          Q{{ (gs.state().questionIndex ?? 0) + 1 }}
          @if (gs.state().totalQuestions) {
            / {{ gs.state().totalQuestions }}
          }
          @if (gs.status() === 'QUESTION_CLOSED') {
            CORRIG&Eacute;E
          }
        </span>
        <span class="badge-mcq" style="font-size:10px;padding:2px 7px;border-radius:5px">MCQ</span>
        @if (gs.state().timeLimit) {
          <span>{{ gs.state().timeLimit }} secondes</span>
        }
      </div>

      <!-- Question title -->
      <div class="font-display font-bold" style="font-size:18px;line-height:1.35;letter-spacing:-0.3px" data-testid="question-title">
        {{ gs.state().questionTitle }}
      </div>

      <!-- QUESTION_TITLE state: show trigger choices button -->
      @if (gs.status() === 'QUESTION_TITLE') {
        <div data-testid="title-phase">
          <button
            class="btn-primary btn-primary--lg"
            [disabled]="isWaitingChoices()"
            (click)="onTriggerChoices()"
            data-testid="btn-trigger-choices"
          >
            Afficher les choix
          </button>
        </div>
      }

      <!-- QUESTION_OPEN state: timer + choices + corriger -->
      @if (gs.status() === 'QUESTION_OPEN') {
        <div data-testid="open-phase" class="flex-col gap-4">
          <!-- Timer -->
          <div class="timer-block" data-testid="timer">
            <div class="timer-row">
              <div>
                <div class="timer-val" [class.critical]="remainingSeconds() <= 5">{{ remainingSeconds() }}</div>
                <div class="timer-label">secondes restantes</div>
              </div>
            </div>
            <div class="timer-bar-track">
              <div class="timer-bar-fill"
                [class.critical]="remainingSeconds() <= 5"
                [style.width.%]="timerPercent()">
              </div>
            </div>
          </div>

          <!-- Choices grid -->
          <div class="choices-grid" data-testid="choices">
            @for (choice of gs.state().choices; track $index; let i = $index) {
              <div class="choice-card" data-testid="choice">
                <div class="choice-letter">
                  {{ choiceLabels[i] }}
                </div>
                <div style="flex:1">
                  <div class="choice-text">{{ choice }}</div>
                  <div class="choice-pips">
                    @for (pip of getPipsForChoice(i); track $index) {
                      <div class="pip"></div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Corriger button -->
          <div>
            <button
              class="btn-corriger"
              [class.active]="gs.canCorrect() && !isWaitingCorrection()"
              [disabled]="!gs.canCorrect() || isWaitingCorrection()"
              (click)="onTriggerCorrection()"
              data-testid="btn-trigger-correction"
            >
              Corriger
            </button>
            <div class="text-muted" style="font-size:11px;text-align:center;margin-top:6px">
              @if (!gs.canCorrect()) {
                Le bouton s'active quand tous ont r&eacute;pondu ou le chrono expire
              }
            </div>
          </div>
        </div>
      }

      <!-- QUESTION_CLOSED state: correction results + next -->
      @if (gs.status() === 'QUESTION_CLOSED') {
        <div data-testid="closed-phase" class="flex-col gap-4">
          <!-- Timer frozen at 0 -->
          <div class="timer-block">
            <div class="flex items-center gap-2">
              <div class="timer-val-closed">0</div>
              <span class="timer-label">secondes — temps &eacute;coul&eacute;</span>
            </div>
            <div class="timer-bar-track">
              <div class="timer-bar-empty"></div>
            </div>
          </div>

          <!-- Choices with correct/wrong -->
          <div class="choices-grid" data-testid="choices">
            @for (choice of gs.state().choices; track $index; let i = $index) {
              <div
                class="choice-card"
                [class.correct-answer]="choice === lastCorrectAnswer()"
                [class.wrong-answer]="choice !== lastCorrectAnswer()"
                data-testid="choice-result"
              >
                <div class="choice-letter">
                  {{ choiceLabels[i] }}
                </div>
                <div style="flex:1">
                  <div class="choice-text">{{ choice }}</div>
                  @if (choice === lastCorrectAnswer()) {
                    <div class="correct-label">&#10003; Bonne r&eacute;ponse</div>
                  }
                  <div class="choice-pips">
                    @for (pip of getPipsForChoice(i); track $index) {
                      @if (choice === lastCorrectAnswer()) {
                        <div class="pip-correct"></div>
                      } @else {
                        <div class="pip-wrong"></div>
                      }
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Next question button -->
          <button
            class="btn-next"
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
