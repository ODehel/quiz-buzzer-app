import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  Injector,
  ViewChild,
  DestroyRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameStateService } from '../../core/services/game-state.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { PlayerListComponent } from './player-list/player-list.component';
import { McqControlComponent } from './mcq-control/mcq-control.component';
import { SpeedControlComponent } from './speed-control/speed-control.component';
import { SoundPanelComponent } from './sound-panel/sound-panel.component';
import { RankingComponent } from './ranking/ranking.component';
import type { InboundMessage, OutboundMessage } from '../../core/models/websocket.models';

@Component({
  selector: 'app-play',
  imports: [
    RouterLink,
    PlayerListComponent,
    McqControlComponent,
    SpeedControlComponent,
    SoundPanelComponent,
    RankingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell" data-testid="play">
      <!-- CA-24: Error banner for IN_ERROR -->
      @if (gs.status() === 'IN_ERROR') {
        <div class="toast-error" style="position:relative;bottom:auto;right:auto;max-width:none;border-radius:0;display:flex;align-items:center;justify-content:center;gap:16px;flex-direction:row" data-testid="error-banner">
          <span>La partie est en erreur serveur — le jeu a été interrompu</span>
          <!-- CA-25: Partial results button -->
          <a
            class="btn-outline-sm"
            [routerLink]="['/games', gs.state().gameId, 'results']"
            data-testid="btn-partial-results"
          >
            Voir les résultats partiels
          </a>
        </div>
      }

      <!-- Topbar pilotage -->
      <header class="topbar topbar--pilot">
        <div class="topbar-logo">Quiz<span>Buzzer</span></div>
        <div class="topbar-divider"></div>
        <div class="topbar-quiz">
          <strong>{{ gs.state().quizId }}</strong>
          &middot; Question <strong>{{ (gs.state().questionIndex ?? 0) + 1 }}</strong>
          @if (gs.state().totalQuestions) {
            / {{ gs.state().totalQuestions }}
          }
        </div>
        <div class="topbar-spacer"></div>
        <!-- Status chip -->
        <div class="status-chip"
          [class.status-chip--open]="gs.status() === 'QUESTION_OPEN' || gs.status() === 'QUESTION_TITLE' || gs.status() === 'OPEN'"
          [class.status-chip--closed]="gs.status() === 'QUESTION_CLOSED'"
          [class.status-chip--buzzed]="gs.status() === 'QUESTION_BUZZED'">
          <div class="chip-dot"></div>
          @switch (gs.status()) {
            @case ('OPEN') { EN ATTENTE }
            @case ('QUESTION_TITLE') { TITRE AFFICHÉ }
            @case ('QUESTION_OPEN') { QUESTION OUVERTE }
            @case ('QUESTION_CLOSED') { QUESTION FERMÉE }
            @case ('QUESTION_BUZZED') { BUZZER ACTIF }
            @case ('IN_ERROR') { ERREUR }
            @default { {{ gs.status() }} }
          }
        </div>
        <div class="topbar-divider"></div>
        <div class="ws-dot"></div>
        <span class="ws-label">Connecté</span>
      </header>

      <!-- Layout 3 colonnes -->
      <div class="play-layout">
        <!-- Left column: Player list -->
        <div class="col col-left" data-testid="sidebar-left">
          <app-player-list />
        </div>

        <!-- Center: Main control area -->
        <div class="col col-mid" data-testid="main-area">
          <!-- CA-26: No piloting actions when IN_ERROR -->
          @if (gs.status() !== 'IN_ERROR') {
            @if (gs.status() === 'OPEN') {
              <div style="display:flex;align-items:center;justify-content:center;flex:1">
                <button
                  class="btn-primary btn-primary--lg"
                  [disabled]="isWaitingTrigger()"
                  (click)="onTriggerTitle()"
                  data-testid="btn-trigger-title"
                >
                  Déclencher la question
                </button>
              </div>
            }

            @if (gs.status() === 'QUESTION_TITLE' || gs.status() === 'QUESTION_OPEN'
                 || gs.status() === 'QUESTION_CLOSED' || gs.status() === 'QUESTION_BUZZED') {
              @if (gs.state().questionType === 'MCQ') {
                <app-mcq-control
                  #mcqControl
                  (triggerChoices)="ws.send({ type: 'trigger_choices' })"
                  (triggerCorrection)="ws.send({ type: 'trigger_correction' })"
                  (triggerNext)="ws.send({ type: 'trigger_next_question' })" />
              } @else {
                <app-speed-control
                  #speedControl
                  (validateAnswer)="ws.send({ type: 'validate_answer' })"
                  (invalidateAnswer)="ws.send({ type: 'invalidate_answer' })"
                  (triggerNext)="ws.send({ type: 'trigger_next_question' })" />
              }
            }
          }
        </div>

        <!-- Right column: Sound panel -->
        <div class="col col-right" data-testid="sidebar-right">
          @if (gs.status() !== 'IN_ERROR') {
            <app-sound-panel
              (triggerSystemSound)="ws.send($event)"
              (playSound)="ws.send($event)"
              (triggerRanking)="ws.send({ type: 'trigger_intermediate_ranking' })" />
          }
        </div>
      </div>

      <!-- Ranking overlay -->
      @if (gs.state().ranking) {
        <app-ranking (close)="gs.dismissRanking()" />
      }

      @if (toastMessage()) {
        <div class="toast-error" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
  styles: [],
})
export class PlayComponent {
  protected readonly gs = inject(GameStateService);
  protected readonly ws = inject(WebSocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mcqControl') mcqControl?: McqControlComponent;
  @ViewChild('speedControl') speedControl?: SpeedControlComponent;

  protected readonly isWaitingTrigger = signal(false);
  protected readonly toastMessage = signal<string | null>(null);

  constructor() {
    // CA-29: Show toast from noActiveGameGuard redirect
    const navToast = this.router.getCurrentNavigation()?.extras.state?.['toast'];
    if (navToast) {
      this.showToast(navToast);
    }

    // CA-18: Navigate to results on COMPLETED
    effect(
      () => {
        if (this.gs.status() === 'COMPLETED') {
          this.router.navigate(['/pilot/results']);
        }
      },
      { injector: inject(Injector) }
    );

    // Listen for WS messages to manage sub-component state
    this.ws.messages$
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => this.handleMessage(msg));
  }

  protected onTriggerTitle(): void {
    this.isWaitingTrigger.set(true);
    this.ws.send({ type: 'trigger_title' });
  }

  private handleMessage(msg: InboundMessage): void {
    switch (msg.type) {
      case 'question_title':
      case 'question_open':
        this.isWaitingTrigger.set(false);
        break;
      case 'question_choices':
        this.mcqControl?.resetWaiting();
        if (this.gs.state().startedAt && this.gs.state().timeLimit) {
          this.mcqControl?.startTimer(
            this.gs.state().startedAt!,
            this.gs.state().timeLimit!
          );
        }
        break;
      case 'timer_tick': {
        const remaining = (msg as any).remaining_seconds;
        this.mcqControl?.onTimerTick(remaining);
        this.speedControl?.onTimerTick(remaining);
        break;
      }
      case 'timer_end':
        this.mcqControl?.stopTimer();
        this.mcqControl?.onTimerTick(0);
        this.speedControl?.stopTimer();
        this.speedControl?.onTimerTick(0);
        break;
      case 'buzz_locked':
        this.speedControl?.pauseTimer();
        this.speedControl?.resetWaiting();
        break;
      case 'buzz_unlocked': {
        const remainingSec = (msg as any).remaining_seconds;
        this.speedControl?.resumeTimer(remainingSec);
        break;
      }
      case 'question_result_summary':
        this.mcqControl?.stopTimer();
        this.mcqControl?.resetWaiting();
        this.speedControl?.stopTimer();
        this.speedControl?.resetWaiting();
        break;
      case 'error': {
        const errorMsg = msg as InboundMessage & { code?: string; message?: string };
        if (errorMsg.code === 'ANSWERS_PENDING') {
          this.showToast('Des joueurs n\'ont pas encore répondu');
        } else if (errorMsg.code === 'INVALID_STATE') {
          this.showToast('Classement indisponible dans cet état');
        }
        break;
      }
    }
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
