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
import { ToastService } from '../../core/services/toast.service';

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
  templateUrl: './play.component.html',
  styles: [],
})
export class PlayComponent {
  protected readonly gs = inject(GameStateService);
  protected readonly ws = inject(WebSocketService);
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mcqControl') mcqControl?: McqControlComponent;
  @ViewChild('speedControl') speedControl?: SpeedControlComponent;

  protected readonly isWaitingTrigger = signal(false);
  constructor() {
    // CA-29: Show toast from noActiveGameGuard redirect
    const navToast = this.router.getCurrentNavigation()?.extras.state?.['toast'];
    if (navToast) {
      this.toast.show(navToast);
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
          this.toast.show('Des joueurs n\'ont pas encore répondu');
        } else if (errorMsg.code === 'INVALID_STATE') {
          this.toast.show('Classement indisponible dans cet état');
        }
        break;
      }
    }
  }
}
