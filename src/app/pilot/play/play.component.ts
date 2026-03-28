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
  standalone: true,
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
    <div class="play" data-testid="play">
      <!-- CA-24: Error banner for IN_ERROR -->
      @if (gs.status() === 'IN_ERROR') {
        <div class="play__error-banner" data-testid="error-banner">
          <span>La partie est en erreur serveur — le jeu a été interrompu</span>
          <!-- CA-25: Partial results button -->
          <a
            class="play__error-btn"
            [routerLink]="['/games', gs.state().gameId, 'results']"
            data-testid="btn-partial-results"
          >
            Voir les résultats partiels
          </a>
        </div>
      }

      <div class="play__layout">
        <!-- Left column: Player list -->
        <aside class="play__sidebar play__sidebar--left" data-testid="sidebar-left">
          <app-player-list />
        </aside>

        <!-- Center: Main control area -->
        <main class="play__main" data-testid="main-area">
          <!-- CA-26: No piloting actions when IN_ERROR -->
          @if (gs.status() !== 'IN_ERROR') {
            @if (gs.status() === 'OPEN') {
              <div class="play__trigger" data-testid="trigger-phase">
                <button
                  class="btn btn--primary btn--lg"
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
        </main>

        <!-- Right column: Sound panel -->
        <aside class="play__sidebar play__sidebar--right" data-testid="sidebar-right">
          @if (gs.status() !== 'IN_ERROR') {
            <app-sound-panel
              (triggerSystemSound)="ws.send($event)"
              (playSound)="ws.send($event)"
              (triggerRanking)="ws.send({ type: 'trigger_intermediate_ranking' })" />
          }
        </aside>
      </div>

      <!-- Ranking overlay -->
      @if (gs.state().ranking) {
        <app-ranking (close)="gs.dismissRanking()" />
      }

      @if (toastMessage()) {
        <div class="toast toast--error" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .play { height: 100%; display: flex; flex-direction: column; }
    .play__error-banner { background: #dc3545; color: #fff; padding: 12px 24px; text-align: center; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 16px; }
    .play__error-btn { background: #fff; color: #dc3545; padding: 6px 16px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .play__error-btn:hover { background: #f8d7da; }
    .play__layout { display: grid; grid-template-columns: 250px 1fr 280px; gap: 0; flex: 1; overflow: hidden; }
    .play__sidebar { border-right: 1px solid #dee2e6; overflow-y: auto; }
    .play__sidebar--right { border-right: none; border-left: 1px solid #dee2e6; }
    .play__main { padding: 24px; overflow-y: auto; }
    .play__trigger { display: flex; align-items: center; justify-content: center; height: 100%; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
    .btn--lg { padding: 16px 48px; font-size: 1.2rem; }
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; color: #fff; }
    .toast--error { background: #dc3545; }
    .toast--info { background: #0d6efd; }
  `],
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
