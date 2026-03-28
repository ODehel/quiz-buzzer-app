import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Subject, switchMap, catchError, EMPTY } from 'rxjs';

import { GameService } from './game.service';
import { QuizService } from '../content/quizzes/quiz.service';
import { GameStateService } from '../core/services/game-state.service';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';
import { PaginatorComponent } from '../shared/paginator/paginator.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import type { Game } from '../core/models/game.models';

export interface GameRow extends Game {
  quizName: string;
}

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [
    RouterLink,
    StatusBadgeComponent,
    PaginatorComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="game-list">
      <header class="game-list__header">
        <h1>Parties</h1>
        <button
          class="btn btn--primary"
          (click)="onNewGameClick()"
          data-testid="btn-new-game"
        >
          Nouvelle partie
        </button>
      </header>

      @if (isLoading()) {
        <div class="loading" data-testid="loading">Chargement...</div>
      } @else if (games().length === 0) {
        <p class="empty" data-testid="empty-list">Aucune partie</p>
      } @else {
        <table class="table" data-testid="games-table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Statut</th>
              <th>Date de création</th>
              <th>Participants</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (game of games(); track game.id) {
              <tr data-testid="game-row">
                <td data-testid="game-quiz-name">{{ game.quizName }}</td>
                <td><app-status-badge [status]="game.status" /></td>
                <td data-testid="game-date">{{ formatDate(game.created_at) }}</td>
                <td data-testid="game-participants">{{ game.participants.length }}</td>
                <td class="actions">
                  <a
                    class="btn btn--sm"
                    [routerLink]="gameRoute(game)"
                    data-testid="btn-view"
                  >
                    Voir
                  </a>
                  @if (game.status === 'PENDING') {
                    <button
                      class="btn btn--sm btn--danger"
                      (click)="onDeleteClick(game)"
                      data-testid="btn-delete"
                    >
                      Supprimer
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        @if (totalPages() > 1) {
          <app-paginator
            [page]="currentPage()"
            [total]="totalPages()"
            (pageChange)="onPageChange($event)"
          />
        }
      }

      @if (toastMessage()) {
        <div class="toast" [class.toast--error]="toastIsError()" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }

      <app-confirm-dialog />
    </div>
  `,
  styles: [`
    .game-list { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .game-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .game-list__header h1 { margin: 0; font-size: 1.5rem; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .table th { font-weight: 600; font-size: 0.85rem; color: #6c757d; }
    .actions { display: flex; gap: 4px; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--sm { padding: 4px 12px; font-size: 0.8rem; background: #e9ecef; color: #495057; }
    .btn--danger { background: #f8d7da; color: #842029; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .empty { text-align: center; padding: 48px; color: #6c757d; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #198754; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; }
  `],
})
export class GameListComponent {
  private readonly gameService = inject(GameService);
  private readonly quizService = inject(QuizService);
  private readonly gs = inject(GameStateService);
  private readonly router = inject(Router);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly games = signal<GameRow[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

  private quizNameMap = new Map<string, string>();
  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          return this.gameService
            .getAll({ page: this.currentPage(), limit: 20 })
            .pipe(
              catchError(() => {
                this.isLoading.set(false);
                this.showToast('Erreur lors du chargement', true);
                return EMPTY;
              })
            );
        }),
        takeUntilDestroyed()
      )
      .subscribe((response) => {
        this.applyGamesResponse(response);
      });

    // Initial load: games + quizzes in parallel
    forkJoin({
      games: this.gameService.getAll({ page: 1, limit: 20 }),
      quizzes: this.quizService.getAll({ page: 1, limit: 100 }),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ games, quizzes }) => {
          this.quizNameMap = new Map(
            quizzes.data.map((q) => [q.id, q.name])
          );
          this.applyGamesResponse(games);
        },
        error: () => {
          this.isLoading.set(false);
          this.showToast('Erreur lors du chargement', true);
        },
      });
  }

  protected onNewGameClick(): void {
    if (this.gs.isPiloting()) {
      this.showToast('Une partie est déjà en cours', true);
      return;
    }
    this.router.navigate(['/games/new']);
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTrigger$.next();
  }

  protected async onDeleteClick(game: GameRow): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer la partie "${game.quizName}" ?`
    );
    if (!confirmed) return;

    try {
      await this.gameService.delete(game.id);
      this.showToast('Partie supprimée');
      this.loadTrigger$.next();
    } catch {
      this.showToast('Erreur lors de la suppression', true);
    }
  }

  protected gameRoute(game: Game): string {
    const s = game.status;
    if (s === 'COMPLETED' || s === 'IN_ERROR') return `/games/${game.id}/results`;
    if (s === 'PENDING') return '/pilot/lobby';
    return '/pilot/play';
  }

  protected formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86_400_000);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const time = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (target.getTime() === today.getTime()) return `Auj. ${time}`;
    if (target.getTime() === yesterday.getTime()) return `Hier ${time}`;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private applyGamesResponse(response: { data: Game[]; total_pages: number; page: number }): void {
    this.games.set(
      response.data.map((g) => ({
        ...g,
        quizName: this.quizNameMap.get(g.quiz_id) ?? g.quiz_id,
      }))
    );
    this.totalPages.set(response.total_pages);
    this.currentPage.set(response.page);
    this.isLoading.set(false);
  }

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
