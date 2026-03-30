import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, catchError } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { GameService } from '../games/game.service';
import { QuizService } from '../content/quizzes/quiz.service';
import { QuestionService } from '../content/questions/question.service';
import { GameStateService } from '../core/services/game-state.service';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';
import type { Game, HealthResponse } from '../core/models/game.models';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  imports: [StatusBadgeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly gameService = inject(GameService);
  private readonly quizService = inject(QuizService);
  private readonly questionService = inject(QuestionService);
  protected readonly gs = inject(GameStateService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  protected readonly recentGames = signal<Game[]>([]);
  protected readonly quizCount = signal<number | null>(null);
  protected readonly questionCount = signal<number | null>(null);
  protected readonly gameCount = signal<number | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly serverVersion = signal<string | null>(null);
  protected readonly toastMessage = signal<string | null>(null);

  protected readonly activeBannerRoute = computed(() => {
    const s = this.gs.status();
    if (!s || s === 'COMPLETED' || s === 'IN_ERROR') return null;
    return s === 'PENDING' ? '/pilot/lobby' : '/pilot/play';
  });

  protected readonly buzzersSummary = computed(() => {
    const buzzers = this.gs.connectedBuzzers();
    if (buzzers.length === 0) return '';
    if (buzzers.length <= 3) return buzzers.join(', ');
    return `${buzzers.slice(0, 3).join(', ')} +${buzzers.length - 3}`;
  });

  constructor() {
    this.loadDashboardData();

    // Poll for buzzer updates on the dashboard
    this.gs.startPolling(5_000);
    inject(DestroyRef).onDestroy(() => this.gs.stopPolling());
  }

  private loadDashboardData(): void {
    forkJoin({
      games: this.gameService.getRecent(4).pipe(catchError(() => of(null))),
      quizCount: this.quizService.getCount().pipe(catchError(() => of(null))),
      questionCount: this.questionService.getCount().pipe(catchError(() => of(null))),
      gameCount: this.gameService.getCount().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ games, quizCount, questionCount, gameCount }) => {
          if (games) this.recentGames.set(games);
          this.quizCount.set(quizCount);
          this.questionCount.set(questionCount);
          this.gameCount.set(gameCount);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected onNewGameClick(): void {
    if (this.gs.isPiloting()) {
      this.toastMessage.set('Une partie est déjà en cours');
      setTimeout(() => this.toastMessage.set(null), 4000);
      return;
    }
    this.router.navigate(['/games/new']);
  }

  protected gameDetailRoute(game: Game): string {
    const s = game.status;
    if (s === 'COMPLETED' || s === 'IN_ERROR') return `/games/${game.id}/results`;
    if (s === 'PENDING') return '/pilot/lobby';
    return '/pilot/play';
  }

  protected formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86_400_000);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (target.getTime() === today.getTime()) return `Auj. ${time}`;
    if (target.getTime() === yesterday.getTime()) return `Hier ${time}`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}
