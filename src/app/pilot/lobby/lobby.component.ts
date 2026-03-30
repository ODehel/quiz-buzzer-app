import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  Injector,
  DestroyRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameStateService } from '../../core/services/game-state.service';
import { GameService } from '../../games/game.service';
import { QuizService } from '../../content/quizzes/quiz.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../core/services/toast.service';

const MAX_BUZZER_SLOTS = 10;

@Component({
  selector: 'app-lobby',
  imports: [ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.css',
})
export class LobbyComponent {
  protected readonly gs = inject(GameStateService);
  private readonly gameService = inject(GameService);
  protected readonly toast = inject(ToastService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  protected readonly MAX_BUZZER_SLOTS = MAX_BUZZER_SLOTS;

  @ViewChild('confirmDialog') confirmDialog!: ConfirmDialogComponent;

  protected readonly quizName = signal<string | null>(null);
  protected readonly isStarting = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly isReady = computed(
    () => this.gs.connectedBuzzers().length >= this.gs.state().participants.length
  );

  protected readonly readinessPercent = computed(() => {
    const participants = this.gs.state().participants.length;
    if (participants === 0) return 100;
    return Math.min(100, (this.gs.connectedBuzzers().length / participants) * 100);
  });

  protected readonly participantsWithBuzzer = computed(() => {
    const participants = this.gs.state().participants;
    const buzzers = this.gs.connectedBuzzers();
    return participants.map((p, i) => ({
      ...p,
      buzzerUsername: buzzers[i] ?? null,
    }));
  });

  protected readonly buzzerSlots = computed(() => {
    const buzzers = this.gs.connectedBuzzers();
    return Array.from({ length: MAX_BUZZER_SLOTS }, (_, i) => ({
      index: i,
      username: buzzers[i] ?? null,
    }));
  });

  constructor() {
    // CA-2: redirect if game already started
    const currentStatus = this.gs.status();
    if (currentStatus === 'OPEN' || currentStatus?.startsWith('QUESTION_')) {
      this.router.navigate(['/pilot/play']);
      return;
    }

    // CA-4: load quiz name
    const quizId = this.gs.state().quizId;
    if (quizId) {
      this.quizService
        .getById(quizId)
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe({
          next: (q) => this.quizName.set(q.name),
          error: () => this.quizName.set('Quiz inconnu'),
        });
    }

    // Poll for buzzer updates while in lobby
    this.gs.startPolling(3_000);
    inject(DestroyRef).onDestroy(() => this.gs.stopPolling());

    // CA-17/CA-24: navigate to /pilot/play when status transitions to OPEN or QUESTION_*
    effect(
      () => {
        const s = this.gs.status();
        if (s === 'OPEN' || s?.startsWith('QUESTION_')) {
          this.gs.stopPolling();
          this.router.navigate(['/pilot/play']);
        }
      },
      { injector: inject(Injector) }
    );
  }

  async onStartGame(): Promise<void> {
    const gameId = this.gs.state().gameId;
    if (!gameId) return;

    this.isStarting.set(true);
    try {
      await this.gameService.start(gameId);
      // CA-16: navigation triggered by effect() on game_state_sync, not here
    } catch {
      // CA-18: error toast
      this.isStarting.set(false);
      this.toast.show('Impossible de démarrer la partie', true);
    }
  }

  async onDeleteGame(): Promise<void> {
    // CA-20: confirmation dialog
    const confirmed = await this.confirmDialog.open(
      'Supprimer la partie en attente ?'
    );
    if (!confirmed) return;

    const gameId = this.gs.state().gameId;
    if (!gameId) return;

    this.isDeleting.set(true);
    try {
      // CA-21: delete game
      await this.gameService.delete(gameId);
      this.gs.reset();
      this.toast.show('Partie annulée', false);
      this.router.navigate(['/games']);
    } catch {
      // CA-22: error toast
      this.isDeleting.set(false);
      this.toast.show('Erreur lors de la suppression', true);
    }
  }
}
