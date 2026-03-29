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

const MAX_BUZZER_SLOTS = 10;

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- En-tete + actions -->
    <div class="lobby-header" data-testid="lobby-header">
      <div>
        <h1 class="lobby-title">Lobby d'attente</h1>
        <div class="lobby-quiz-name">
          <span data-testid="quiz-name">Quiz : <span>{{ quizName() ?? 'Chargement...' }}</span></span>
          &nbsp;&middot;&nbsp;
          <span data-testid="participant-count">{{ gs.state().participants.length }} participants</span>
        </div>
      </div>
      <div class="lobby-actions" data-testid="lobby-actions">
        <button
          class="btn-cancel-game"
          (click)="onDeleteGame()"
          [disabled]="isDeleting()"
          data-testid="btn-delete"
        >
          Annuler la partie
        </button>
        <button
          class="btn-start"
          [class.loading]="isStarting()"
          (click)="onStartGame()"
          [disabled]="isStarting()"
          data-testid="btn-start"
        >
          @if (isStarting()) {
            <div class="spinner"></div>
            Demarrage en cours...
          } @else {
            Demarrer la partie
          }
        </button>
      </div>
    </div>

    <!-- Barre de readiness -->
    <div
      class="readiness-bar-wrap"
      [class.insufficient]="!isReady()"
      [class.ready]="isReady()"
      data-testid="readiness-bar"
    >
      <div class="readiness-header">
        <span class="readiness-title">Readiness</span>
        <span
          class="readiness-count"
          [class.insufficient]="!isReady()"
          [class.ready]="isReady()"
          data-testid="readiness-label"
        >
          {{ gs.connectedBuzzers().length }} / {{ gs.state().participants.length }} buzzers connectes
        </span>
      </div>
      <div class="bar-track">
        <div
          class="bar-fill"
          [class.insufficient]="!isReady()"
          [class.ready]="isReady()"
          [style.width.%]="readinessPercent()"
        ></div>
      </div>
    </div>

    <!-- Grille 2 colonnes : participants + buzzers -->
    <div class="lobby-grid">

      <!-- Panneau participants -->
      <div class="panel" data-testid="participants-panel">
        <div class="panel-header">
          <span class="panel-title">Participants</span>
          <span style="font-size:11px;color:var(--muted)">{{ gs.state().participants.length }} joueurs enregistres</span>
        </div>
        @for (entry of participantsWithBuzzer(); track entry.order) {
          <div class="participant-row" data-testid="participant-item">
            <span class="p-order">{{ entry.order }}</span>
            <span class="p-name">{{ entry.name }}</span>
            @if (entry.buzzerUsername) {
              <div class="buzzer-tag connected" data-testid="buzzer-status">
                <div class="buzzer-tag-dot"></div>
                {{ entry.buzzerUsername }}
              </div>
            } @else {
              <div class="buzzer-tag offline" data-testid="buzzer-status">
                <div class="buzzer-tag-dot"></div>
                Non connecte
              </div>
            }
          </div>
        }
      </div>

      <!-- Panneau buzzers -->
      <div class="panel" data-testid="buzzers-panel">
        <div class="panel-header">
          <span class="panel-title">Buzzers</span>
          <span style="font-size:11px;color:var(--green);font-weight:600">{{ gs.connectedBuzzers().length }} / {{ MAX_BUZZER_SLOTS }} connectes</span>
        </div>
        @for (slot of buzzerSlots(); track slot.index) {
          <div class="buzzer-row" [style.opacity]="slot.username ? 1 : 0.4" data-testid="buzzer-slot">
            <div class="buzzer-avatar" [class.online]="slot.username" [class.offline]="!slot.username">
              B{{ slot.index + 1 }}
            </div>
            <div class="buzzer-info">
              @if (slot.username) {
                <div class="buzzer-name" data-testid="buzzer-username">{{ slot.username }}</div>
              } @else {
                <div class="buzzer-name offline" data-testid="buzzer-username">—</div>
              }
            </div>
            @if (slot.username) {
              <div class="buzzer-online-dot"></div>
            } @else {
              <div class="buzzer-offline-dot"></div>
            }
          </div>
        }
      </div>

    </div>

    @if (toastMessage()) {
      <div
        class="toast"
        [class.toast--error]="toastIsError()"
        [class.toast--success]="!toastIsError()"
        data-testid="toast"
      >
        {{ toastMessage() }}
      </div>
    }

    <app-confirm-dialog #confirmDialog />
  `,
  styles: [],
})
export class LobbyComponent {
  protected readonly gs = inject(GameStateService);
  private readonly gameService = inject(GameService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  protected readonly MAX_BUZZER_SLOTS = MAX_BUZZER_SLOTS;

  @ViewChild('confirmDialog') confirmDialog!: ConfirmDialogComponent;

  protected readonly quizName = signal<string | null>(null);
  protected readonly isStarting = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

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
      this.showToast('Impossible de démarrer la partie', true);
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
      this.showToast('Partie annulée', false);
      this.router.navigate(['/games']);
    } catch {
      // CA-22: error toast
      this.isDeleting.set(false);
      this.showToast('Erreur lors de la suppression', true);
    }
  }

  private showToast(message: string, isError: boolean): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
