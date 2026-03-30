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
  imports: [
    RouterLink,
    StatusBadgeComponent,
    PaginatorComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './game-list.component.html',
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
