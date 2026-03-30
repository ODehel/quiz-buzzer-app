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
  template: `
    <!-- Page header -->
    <div class="page-header">
      <h1 class="page-title">Tableau de bord</h1>
      <button class="btn-primary" (click)="onNewGameClick()">
        <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Nouvelle partie
      </button>
    </div>

    <!-- Active game banner -->
    @if (gs.isPiloting()) {
      <div class="banner-active" data-testid="active-banner">
        <div class="banner-dot"></div>
        <div class="banner-content">
          <div class="banner-title">
            {{ gs.state().quizId || 'Partie active' }}
            @if (gs.state().questionIndex !== null) {
              <span style="font-weight:400;color:var(--muted)">— Question {{ gs.state().questionIndex }}</span>
            }
          </div>
          <div class="banner-sub">
            Statut :
            <span style="color:#60a5fa;font-weight:500">
              {{ gs.status() === 'PENDING' ? 'En attente' : 'En cours' }}
            </span>
          </div>
        </div>
        <a
          class="btn-outline-sm"
          [routerLink]="activeBannerRoute()"
          data-testid="resume-piloting"
        >Reprendre le pilotage →</a>
      </div>
    }

    @if (isLoading()) {
      <div style="text-align:center;padding:48px;color:var(--muted)" data-testid="loading">Chargement…</div>
    } @else {
      <!-- Metrics grid -->
      <div class="metrics-grid" data-testid="metrics">
        <div class="metric-card">
          <div class="metric-label">Buzzers connectés<span class="live-badge">Live</span></div>
          <div class="metric-value live" data-testid="metric-buzzers">{{ gs.connectedBuzzers().length }}</div>
          <div class="metric-sub" data-testid="buzzer-names">{{ buzzersSummary() }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Quiz disponibles</div>
          <div class="metric-value" data-testid="metric-quizzes">{{ quizCount() ?? '—' }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Questions en banque</div>
          <div class="metric-value" data-testid="metric-questions">{{ questionCount() ?? '—' }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Parties jouées</div>
          <div class="metric-value" data-testid="metric-games">{{ gameCount() ?? '—' }}</div>
        </div>
      </div>

      <!-- Content grid -->
      <div class="content-grid">
        <!-- Recent games widget -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">Dernières parties</span>
            <a class="widget-action" routerLink="/games">Voir tout →</a>
          </div>
          @if (recentGames().length === 0) {
            <div style="padding:24px;text-align:center;color:var(--muted)" data-testid="no-games">Aucune partie</div>
          } @else {
            <div class="games-table" data-testid="games-table">
              @for (game of recentGames(); track game.id) {
                <div class="games-row">
                  <div>
                    <div class="game-name">{{ game.quiz_name }}</div>
                    <div class="game-date">{{ formatDate(game.created_at) }}</div>
                  </div>
                  <div><app-status-badge [status]="game.status" /></div>
                  <div class="game-date">{{ game.participants.length }} joueurs</div>
                  <a class="game-action" [routerLink]="gameDetailRoute(game)" data-testid="game-link">
                    {{ game.status === 'COMPLETED' || game.status === 'IN_ERROR' ? 'Résultats →' : game.status === 'PENDING' ? 'Lobby →' : 'Piloter →' }}
                  </a>
                </div>
              }
            </div>
          }
        </div>

        <!-- Buzzers widget -->
        <div class="widget">
          <div class="widget-header">
            <span class="widget-title">Buzzers</span>
            <span style="font-size:11px;color:var(--green);font-weight:600">{{ gs.connectedBuzzers().length }} connectés</span>
          </div>
          <div class="buzzers-list">
            @for (buzzer of gs.connectedBuzzers(); track buzzer) {
              <div class="buzzer-row">
                <div class="buzzer-avatar">{{ buzzer.substring(0, 2).toUpperCase() }}</div>
                <div>
                  <div class="buzzer-name">{{ buzzer }}</div>
                </div>
                <div class="buzzer-status-dot"></div>
              </div>
            }
            @if (gs.connectedBuzzers().length === 0) {
              <div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Aucun buzzer connecté</div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Toast -->
    @if (toastMessage()) {
      <div class="toast" data-testid="toast">{{ toastMessage() }}</div>
    }
  `,
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
