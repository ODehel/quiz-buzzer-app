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
            Démarrage…
          } @else {
            <svg style="width:14px;height:14px;fill:#fff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Démarrer la partie
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
          {{ gs.connectedBuzzers().length }} / {{ gs.state().participants.length }} buzzers connectés
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
          <span style="font-size:11px;color:var(--muted)">{{ gs.state().participants.length }} joueurs enregistrés</span>
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
                Non connecté
              </div>
            }
          </div>
        }
      </div>

      <!-- Panneau buzzers -->
      <div class="panel" data-testid="buzzers-panel">
        <div class="panel-header">
          <span class="panel-title">Buzzers</span>
          <span style="font-size:11px;color:var(--green);font-weight:600">{{ gs.connectedBuzzers().length }} / {{ MAX_BUZZER_SLOTS }} connectés</span>
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
                <div class="buzzer-name offline" data-testid="buzzer-username">Slot libre</div>
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
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* ── En-tête lobby ── */
    .lobby-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .lobby-title {
      font-family: 'Syne', sans-serif;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .lobby-quiz-name {
      font-size: 14px;
      color: var(--muted);
      margin-top: 4px;
    }
    .lobby-quiz-name span {
      color: var(--accent);
      font-weight: 500;
    }
    .lobby-actions {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
      align-items: flex-start;
    }

    /* ── Readiness title ── */
    .readiness-title {
      font-family: 'Syne', sans-serif;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: var(--muted);
    }

    /* ── Grille 2 colonnes ── */
    .lobby-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* ── Lignes participants ── */
    .participant-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 16px;
      border-bottom: 1px solid var(--border);
    }
    .participant-row:last-child { border-bottom: none; }
    .p-order {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      width: 16px;
      text-align: right;
      flex-shrink: 0;
    }
    .p-name {
      font-size: 13px;
      font-weight: 500;
      flex: 1;
    }

    /* ── Tags buzzer (dans participants) ── */
    .buzzer-tag {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .buzzer-tag.connected {
      background: var(--accent-dim);
      color: #90b8ff;
      border: 1px solid #2a4a8a;
    }
    .buzzer-tag.offline {
      background: var(--surface2);
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .buzzer-tag-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .buzzer-tag.connected .buzzer-tag-dot {
      background: var(--green);
      box-shadow: 0 0 4px var(--green);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .buzzer-tag.offline .buzzer-tag-dot {
      background: var(--muted);
    }

    /* ── Lignes buzzers ── */
    .buzzer-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
    }
    .buzzer-row:last-child { border-bottom: none; }
    .buzzer-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }
    .buzzer-avatar.online {
      background: var(--accent-dim);
      border: 1.5px solid var(--accent);
      color: var(--accent);
    }
    .buzzer-avatar.offline {
      background: var(--surface2);
      border: 1.5px solid var(--border);
      color: var(--muted);
    }
    .buzzer-info { flex: 1; }
    .buzzer-name {
      font-size: 13px;
      font-weight: 500;
    }
    .buzzer-name.offline { color: var(--muted); }
    .buzzer-online-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 5px var(--green);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .buzzer-offline-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border);
    }

    /* ── Toast ── */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 50;
      animation: fadeIn .3s ease;
    }
    .toast--success {
      background: var(--green-dim, #0a2a1a);
      color: var(--green);
      border: 1px solid var(--green);
    }
    .toast--error {
      background: var(--red-dim, #2a0808);
      color: var(--red);
      border: 1px solid var(--red);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `],
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
