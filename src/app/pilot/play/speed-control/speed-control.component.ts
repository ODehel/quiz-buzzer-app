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
  template: `
    <div data-testid="speed-control" class="flex-col gap-4">
      <!-- Question meta -->
      <div class="flex items-center gap-2 text-muted" style="font-size:11px">
        <span class="display-num badge-speed"
          style="font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid var(--purple-border)"
          [style.background]="gs.status() === 'QUESTION_BUZZED' ? 'var(--purple-dim)' : 'var(--accent-dim)'"
          [style.color]="gs.status() === 'QUESTION_BUZZED' ? 'var(--purple)' : 'var(--accent)'"
          [style.border-color]="gs.status() === 'QUESTION_BUZZED' ? 'var(--purple-border)' : '#2a4a8a'"
          data-testid="question-number">
          Q{{ (gs.state().questionIndex ?? 0) + 1 }}
          @if (gs.state().totalQuestions) {
            / {{ gs.state().totalQuestions }}
          }
        </span>
        <span class="badge-speed" style="font-size:10px;padding:2px 7px">SPEED</span>
        @if (gs.state().timeLimit) {
          <span>{{ gs.state().timeLimit }} secondes</span>
        }
      </div>

      <!-- Question title -->
      <div class="font-display font-bold" style="font-size:18px;line-height:1.35;letter-spacing:-0.3px" data-testid="question-title">
        {{ gs.state().questionTitle }}
      </div>

      <!-- Timer (QUESTION_OPEN) -->
      @if (gs.status() === 'QUESTION_OPEN') {
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
      }

      <!-- Timer SUSPENDED (QUESTION_BUZZED) -->
      @if (gs.status() === 'QUESTION_BUZZED') {
        <div class="timer-block" data-testid="timer">
          <div class="flex items-center gap-3">
            <div class="timer-val-s">{{ remainingSeconds() }}</div>
            <div class="suspended-badge">&#9208; Suspendu</div>
          </div>
          <div class="timer-bar-track">
            <div class="timer-bar-suspended" [style.width.%]="timerPercent()"></div>
          </div>
        </div>
      }

      <!-- QUESTION_BUZZED: Buzzer card -->
      @if (gs.status() === 'QUESTION_BUZZED') {
        <div style="background:var(--purple-dim);border:1.5px solid var(--purple);border-radius:14px;padding:20px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;box-shadow:0 0 30px rgba(168,85,247,.15);animation:buzz-in .35s ease-out"
          data-testid="buzzer-info">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--purple)">Buzzeur actif</div>
          <div class="buzzer-avatar" style="width:56px;height:56px;border-radius:50%;background:var(--purple-dim);border:2px solid var(--purple);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--purple);box-shadow:0 0 20px rgba(168,85,247,.3);animation:pulse .8s ease-in-out infinite">
            {{ gs.state().currentBuzzer?.charAt(0)?.toUpperCase() }}
          </div>
          <div class="font-display font-extrabold" style="font-size:22px;letter-spacing:-0.3px">{{ gs.state().currentBuzzer }}</div>
        </div>

        @if (gs.state().timerEnded) {
          <div style="background:var(--amber-dim);border:1px solid #6a3a00;border-radius:10px;padding:12px 14px;font-size:13px;font-weight:700;color:var(--amber);text-align:center" data-testid="timer-hint">
            Temps écoulé — décidez maintenant
          </div>
        }

        <!-- Validate / Invalidate buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" data-testid="buzz-actions">
          <button
            class="btn-validate"
            [disabled]="isWaitingValidation()"
            (click)="onValidateAnswer()"
            data-testid="btn-validate"
          >
            Valider
          </button>
          <button
            class="btn-invalidate"
            [disabled]="isWaitingValidation()"
            (click)="onInvalidateAnswer()"
            data-testid="btn-invalidate"
          >
            Invalider
          </button>
        </div>
      }

      <!-- QUESTION_OPEN: disabled buttons -->
      @if (gs.status() === 'QUESTION_OPEN') {
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" data-testid="open-actions">
          <button class="btn-validate" disabled data-testid="btn-validate">
            Valider
          </button>
          <button class="btn-invalidate" disabled data-testid="btn-invalidate">
            Invalider
          </button>
        </div>
      }

      <!-- QUESTION_CLOSED: results -->
      @if (gs.status() === 'QUESTION_CLOSED') {
        <div data-testid="result-phase" class="flex-col gap-4">
          @if (speedWinner()) {
            <div style="text-align:center;padding:16px;background:var(--green-dim);border:1px solid var(--green-border);border-radius:10px;font-size:1.1rem;font-weight:700;color:var(--green)" data-testid="winner">
              Gagnant : {{ speedWinner() }}
            </div>
          } @else {
            <div style="text-align:center;padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;font-size:1.1rem;color:var(--muted)" data-testid="no-winner">
              Aucun gagnant
            </div>
          }

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
