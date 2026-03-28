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
    <div class="lobby">
      <!-- En-tête -->
      <header class="lobby__header" data-testid="lobby-header">
        <h1>Lobby d'attente</h1>
        <div class="lobby__meta">
          <span data-testid="quiz-name">{{ quizName() ?? 'Chargement...' }}</span>
          <span data-testid="participant-count">{{ gs.state().participants.length }} participants</span>
        </div>
      </header>

      <!-- Barre de readiness -->
      <div
        class="readiness"
        [class.readiness--ready]="isReady()"
        [class.readiness--waiting]="!isReady()"
        data-testid="readiness-bar"
      >
        <div class="readiness__bar">
          <div
            class="readiness__fill"
            [style.width.%]="readinessPercent()"
          ></div>
        </div>
        <span class="readiness__label" data-testid="readiness-label">
          {{ gs.connectedBuzzers().length }} buzzers connectés sur {{ gs.state().participants.length }} attendus
        </span>
      </div>

      <div class="lobby__panels">
        <!-- Panneau des participants -->
        <section class="panel" data-testid="participants-panel">
          <h2>Participants</h2>
          <ul class="panel__list">
            @for (entry of participantsWithBuzzer(); track entry.order) {
              <li class="panel__item" data-testid="participant-item">
                <span class="panel__order">{{ entry.order }}</span>
                <span class="panel__name">{{ entry.name }}</span>
                @if (entry.buzzerUsername) {
                  <span class="panel__buzzer panel__buzzer--connected" data-testid="buzzer-status">
                    {{ entry.buzzerUsername }}
                  </span>
                } @else {
                  <span class="panel__buzzer panel__buzzer--disconnected" data-testid="buzzer-status">
                    Non connecté
                  </span>
                }
              </li>
            }
          </ul>
        </section>

        <!-- Panneau des buzzers -->
        <section class="panel" data-testid="buzzers-panel">
          <h2>Buzzers</h2>
          <ul class="panel__list">
            @for (slot of buzzerSlots(); track slot.index) {
              <li
                class="panel__item"
                [class.panel__item--inactive]="!slot.username"
                data-testid="buzzer-slot"
              >
                <span class="panel__order">{{ slot.index + 1 }}</span>
                @if (slot.username) {
                  <span class="panel__name" data-testid="buzzer-username">{{ slot.username }}</span>
                } @else {
                  <span class="panel__name panel__name--empty" data-testid="buzzer-username">—</span>
                }
              </li>
            }
          </ul>
        </section>
      </div>

      <!-- Actions -->
      <div class="lobby__actions" data-testid="lobby-actions">
        <button
          class="btn btn--primary"
          (click)="onStartGame()"
          [disabled]="isStarting()"
          data-testid="btn-start"
        >
          @if (isStarting()) {
            Démarrage en cours...
          } @else {
            Démarrer la partie
          }
        </button>
        <button
          class="btn btn--danger"
          (click)="onDeleteGame()"
          [disabled]="isDeleting()"
          data-testid="btn-delete"
        >
          Annuler la partie
        </button>
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
    </div>
  `,
  styles: [`
    .lobby { padding: 24px; max-width: 800px; margin: 0 auto; }
    .lobby__header { margin-bottom: 24px; }
    .lobby__header h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .lobby__meta { display: flex; gap: 16px; color: #6c757d; font-size: 0.9rem; }
    .readiness { margin-bottom: 24px; }
    .readiness__bar { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
    .readiness__fill { height: 100%; transition: width 0.3s ease; border-radius: 4px; }
    .readiness--ready .readiness__fill { background: #28a745; }
    .readiness--waiting .readiness__fill { background: #fd7e14; }
    .readiness__label { display: block; margin-top: 6px; font-size: 0.85rem; color: #495057; }
    .lobby__panels { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .panel h2 { font-size: 1.1rem; margin: 0 0 12px; }
    .panel__list { list-style: none; padding: 0; margin: 0; }
    .panel__item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 6px; font-size: 0.9rem; }
    .panel__item--inactive { opacity: 0.4; }
    .panel__order { font-weight: 600; min-width: 20px; color: #6c757d; }
    .panel__name { flex: 1; }
    .panel__name--empty { color: #adb5bd; }
    .panel__buzzer { font-size: 0.8rem; }
    .panel__buzzer--connected { color: #28a745; }
    .panel__buzzer--disconnected { color: #adb5bd; }
    .lobby__actions { display: flex; gap: 12px; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
    .btn--danger { background: #dc3545; color: #fff; }
    .btn--danger:disabled { opacity: 0.6; cursor: not-allowed; }
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; color: #fff; }
    .toast--error { background: #dc3545; }
    .toast--success { background: #198754; }
  `],
})
export class LobbyComponent {
  protected readonly gs = inject(GameStateService);
  private readonly gameService = inject(GameService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

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

    // CA-17/CA-24: navigate to /pilot/play when status transitions to OPEN or QUESTION_*
    effect(
      () => {
        const s = this.gs.status();
        if (s === 'OPEN' || s?.startsWith('QUESTION_')) {
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
