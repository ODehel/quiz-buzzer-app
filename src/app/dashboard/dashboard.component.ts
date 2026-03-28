import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
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
  standalone: true,
  imports: [StatusBadgeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <header class="dashboard__header">
        <h1>Tableau de bord</h1>
        <button class="btn btn--primary" (click)="onNewGameClick()">
          Nouvelle partie
        </button>
      </header>

      @if (gs.isPiloting()) {
        <div class="banner banner--active" data-testid="active-banner">
          <div class="banner__info">
            <strong>Partie en cours</strong>
            <span>{{ gs.state().quizId }} — {{ gs.status() }}</span>
            @if (gs.state().questionIndex !== null) {
              <span>Question {{ gs.state().questionIndex }}</span>
            }
          </div>
          <a
            class="btn btn--outline"
            [routerLink]="activeBannerRoute()"
            data-testid="resume-piloting"
          >
            Reprendre le pilotage
          </a>
        </div>
      }

      @if (isLoading()) {
        <div class="loading" data-testid="loading">Chargement…</div>
      } @else {
        <section class="metrics" data-testid="metrics">
          <div class="metric-card">
            <div class="metric-card__value" data-testid="metric-buzzers">
              {{ gs.connectedBuzzers().length }}
            </div>
            <div class="metric-card__label">Buzzers connectés</div>
            <div class="metric-card__sub" data-testid="buzzer-names">
              {{ buzzersSummary() }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value" data-testid="metric-quizzes">
              {{ quizCount() ?? '—' }}
            </div>
            <div class="metric-card__label">Quiz</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value" data-testid="metric-questions">
              {{ questionCount() ?? '—' }}
            </div>
            <div class="metric-card__label">Questions</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value" data-testid="metric-games">
              {{ gameCount() ?? '—' }}
            </div>
            <div class="metric-card__label">Parties jouées</div>
          </div>
        </section>

        <section class="recent-games">
          <h2>Dernières parties</h2>
          @if (recentGames().length === 0) {
            <p data-testid="no-games">Aucune partie</p>
          } @else {
            <table class="table" data-testid="games-table">
              <thead>
                <tr>
                  <th>Partie</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (game of recentGames(); track game.id) {
                  <tr>
                    <td>{{ game.quiz_name }}</td>
                    <td><app-status-badge [status]="game.status" /></td>
                    <td>{{ formatDate(game.created_at) }}</td>
                    <td>
                      <a
                        class="btn btn--sm"
                        [routerLink]="gameDetailRoute(game)"
                        data-testid="game-link"
                      >
                        Voir
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }

      @if (toastMessage()) {
        <div class="toast" data-testid="toast">{{ toastMessage() }}</div>
      }

      @if (serverVersion()) {
        <footer class="dashboard__footer" data-testid="server-version">
          Serveur v{{ serverVersion() }}
        </footer>
      }
    </div>
  `,
  styles: [`
    .dashboard { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .dashboard__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .dashboard__header h1 { margin: 0; font-size: 1.5rem; }
    .banner--active { background: #cce5ff; color: #004085; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .banner__info { display: flex; flex-direction: column; gap: 4px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric-card { background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center; }
    .metric-card__value { font-size: 2rem; font-weight: 700; }
    .metric-card__label { font-size: 0.85rem; color: #6c757d; margin-top: 4px; }
    .metric-card__sub { font-size: 0.75rem; color: #6c757d; margin-top: 4px; min-height: 1em; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .recent-games h2 { font-size: 1.1rem; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .table th { font-weight: 600; font-size: 0.85rem; color: #6c757d; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--outline { background: transparent; border: 1px solid #004085; color: #004085; }
    .btn--sm { padding: 4px 12px; font-size: 0.8rem; background: #e9ecef; color: #495057; }
    .dashboard__footer { margin-top: 24px; text-align: center; font-size: 0.75rem; color: #adb5bd; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #856404; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
  `],
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
    this.loadHealth();
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

  private loadHealth(): void {
    this.http
      .get<HealthResponse>(`${environment.serverUrl}/api/v1/health`)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          if (res.version) this.serverVersion.set(res.version);
        },
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
