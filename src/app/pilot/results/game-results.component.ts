import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameStateService } from '../../core/services/game-state.service';
import { GameService } from '../../games/game.service';
import type { RankingEntry } from '../../core/models/websocket.models';
import type { QuestionResult } from '../../core/services/game-state.service';
import type { McqPlayerResult, SpeedPlayerResult } from '../../core/models/websocket.models';

export interface ResultsData {
  rankings: RankingEntry[];
  questionResults: QuestionResult[];
  participantNames: string[];
}

@Component({
  selector: 'app-game-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="game-results">
      @if (isLoading()) {
        <div data-testid="loading">Chargement des résultats...</div>
      } @else if (results()) {

        <!-- Page header -->
        <div class="page-header">
          <div class="page-header-left">
            <div class="page-title">Résultats</div>
          </div>
          <div class="page-actions">
            <button
              class="btn-primary"
              (click)="onNewGame()"
              [disabled]="gs.isActive()"
              data-testid="btn-new-game"
            >
              Nouvelle partie
            </button>
            <button class="btn-ghost" data-testid="btn-all-games">Toutes les parties</button>
          </div>
        </div>

        <!-- Podium [CA-44] -->
        <section class="podium-section" data-testid="podium">
          <div class="podium-section-title">Classement final</div>
          <div class="podium-stage">
            <!-- 2nd place (left column) -->
            @if (podiumByRank()[2]; as entry) {
              <div class="podium-col">
                <div class="podium-avatar silver" data-testid="podium-entry">
                  {{ entry.participant_name.charAt(0) }}
                </div>
                <div class="podium-name">{{ entry.participant_name }}</div>
                <div class="podium-score silver">{{ entry.cumulative_score }}</div>
                <div class="podium-time">{{ formatTime(entry.total_time_ms) }} cumulé</div>
                <div class="podium-step silver" data-testid="podium-medal">2</div>
              </div>
            }
            <!-- 1st place (center column) -->
            @if (podiumByRank()[1]; as entry) {
              <div class="podium-col">
                <div class="podium-avatar gold" data-testid="podium-entry">
                  {{ entry.participant_name.charAt(0) }}
                </div>
                <div class="podium-name">{{ entry.participant_name }}</div>
                <div class="podium-score gold">{{ entry.cumulative_score }}</div>
                <div class="podium-time">{{ formatTime(entry.total_time_ms) }} cumulé</div>
                <div class="podium-step gold" data-testid="podium-medal">1</div>
              </div>
            }
            <!-- 3rd place (right column) -->
            @if (podiumByRank()[3]; as entry) {
              <div class="podium-col">
                <div class="podium-avatar bronze" data-testid="podium-entry">
                  {{ entry.participant_name.charAt(0) }}
                </div>
                <div class="podium-name">{{ entry.participant_name }}</div>
                <div class="podium-score bronze">{{ entry.cumulative_score }}</div>
                <div class="podium-time">{{ formatTime(entry.total_time_ms) }} cumulé</div>
                <div class="podium-step bronze" data-testid="podium-medal">3</div>
              </div>
            }
          </div>

          <!-- Ranks beyond podium -->
          @for (entry of restRankings(); track entry.rank) {
            <div class="fourth-row">
              <div class="fourth-rank">{{ entry.rank }}</div>
              <div class="fourth-name">{{ entry.participant_name }}</div>
              <div class="fourth-score">{{ entry.cumulative_score }} pts</div>
              <div class="fourth-time">{{ formatTime(entry.total_time_ms) }}</div>
            </div>
          }
        </section>

        <!-- Detail table [CA-45, CA-46] -->
        @if (results()!.questionResults.length > 0) {
          <section class="detail-section" data-testid="detail-section">
            <div class="detail-header">
              <span class="detail-title">Détail par question</span>
            </div>

            <!-- Column headers -->
            <div class="table-head" [style.grid-template-columns]="gridColumns()">
              <div class="th">Q</div>
              <div class="th">Type</div>
              @for (name of results()!.participantNames; track name) {
                <div class="th player">{{ name }}</div>
              }
            </div>

            <!-- Question rows -->
            @for (qr of results()!.questionResults; track qr.question_index) {
              <div class="table-row" [style.grid-template-columns]="gridColumns()" data-testid="detail-row">
                <div class="td-q">Q{{ qr.question_index + 1 }}</div>
                <div class="td-type">
                  <span
                    class="type-chip"
                    [class.type-mcq]="qr.question_type === 'MCQ'"
                    [class.type-speed]="qr.question_type !== 'MCQ'"
                  >
                    {{ qr.question_type === 'MCQ' ? 'MCQ' : 'SPD' }}
                  </span>
                </div>
                @for (name of results()!.participantNames; track name) {
                  <div class="td-cell" data-testid="detail-cell">
                    <div
                      class="cell"
                      [class.cell-correct]="getCellStatus(qr, name) === 'correct'"
                      [class.cell-wrong]="getCellStatus(qr, name) === 'wrong'"
                      [class.cell-absent]="getCellStatus(qr, name) === 'absent'"
                      [class.cell-dash]="getCellStatus(qr, name) === 'dash'"
                    >
                      {{ getCellLabel(qr, name) }}
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Totals row -->
            <div class="table-totals" [style.grid-template-columns]="gridColumns()">
              <div class="total-label">Score final</div>
              @for (name of results()!.participantNames; track name) {
                <div
                  class="total-score"
                  [class.gold]="getRankForName(name) === 1"
                  [class.silver]="getRankForName(name) === 2"
                  [class.bronze]="getRankForName(name) === 3"
                  [class.other]="getRankForName(name) > 3"
                >
                  {{ getScoreForName(name) }}
                </div>
              }
            </div>
          </section>
        }

        <!-- Actions (kept for backwards compat) -->
        <div data-testid="results-actions"></div>
      }
    </div>
  `,
  styles: [],
})
export class GameResultsComponent {
  protected readonly gs = inject(GameStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly results = signal<ResultsData | null>(null);
  protected readonly isLoading = signal(true);

  protected readonly podium = computed(() => {
    const data = this.results();
    if (!data) return [];
    return data.rankings.filter((r) => r.rank <= 3);
  });

  protected readonly podiumByRank = computed(() => {
    const entries = this.podium();
    const map: Record<number, RankingEntry> = {};
    for (const e of entries) {
      map[e.rank] = e;
    }
    return map;
  });

  protected readonly restRankings = computed(() => {
    const data = this.results();
    if (!data) return [];
    return data.rankings.filter((r) => r.rank > 3);
  });

  protected readonly gridColumns = computed(() => {
    const data = this.results();
    if (!data) return '52px 56px';
    const playerCols = data.participantNames.map(() => '1fr').join(' ');
    return `52px 56px ${playerCols}`;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // Live results from GameStateService
      this.loadLiveResults();
    } else {
      // Historical results from REST
      this.loadHistoricalResults(id);
    }
  }

  protected getCellStatus(qr: QuestionResult, participantName: string): string {
    if (qr.question_type === 'MCQ') {
      const result = (qr.results as McqPlayerResult[]).find(
        (r) => r.participant_name === participantName
      );
      if (!result || result.choice === null) return 'absent';
      return result.correct ? 'correct' : 'wrong';
    } else {
      const results = qr.results as SpeedPlayerResult[];
      if (results.length === 0) return 'dash';
      const result = results.find((r) => r.participant_name === participantName);
      if (!result) return 'absent';
      return result.winner ? 'correct' : 'wrong';
    }
  }

  protected getCellLabel(qr: QuestionResult, participantName: string): string {
    if (qr.question_type === 'MCQ') {
      const result = (qr.results as McqPlayerResult[]).find(
        (r) => r.participant_name === participantName
      );
      if (!result || result.choice === null) return '—';
      return `${result.choice} (${result.points_earned}pts)`;
    } else {
      const results = qr.results as SpeedPlayerResult[];
      if (results.length === 0) return '—';
      const result = results.find((r) => r.participant_name === participantName);
      if (!result) return '—';
      return result.winner ? `✓ (${result.points_earned}pts)` : '✗';
    }
  }

  protected formatTime(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  protected getRankForName(name: string): number {
    const data = this.results();
    if (!data) return 999;
    const entry = data.rankings.find((r) => r.participant_name === name);
    return entry ? entry.rank : 999;
  }

  protected getScoreForName(name: string): number {
    const data = this.results();
    if (!data) return 0;
    const entry = data.rankings.find((r) => r.participant_name === name);
    return entry ? entry.cumulative_score : 0;
  }

  protected onNewGame(): void {
    this.router.navigate(['/games/new']);
  }

  private loadLiveResults(): void {
    const questionResults = this.gs.buildResults();
    const lastRanking = questionResults.length > 0
      ? questionResults[questionResults.length - 1].ranking
      : [];
    const participantNames = this.gs.state().participants.map((p) => p.name);

    if (questionResults.length === 0 && this.gs.state().gameId) {
      // Fallback: may have missed messages, load from REST
      this.loadHistoricalResults(this.gs.state().gameId!);
      return;
    }

    this.results.set({
      rankings: lastRanking,
      questionResults,
      participantNames,
    });
    this.isLoading.set(false);
  }

  private loadHistoricalResults(gameId: string): void {
    this.gameService
      .getResults(gameId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.results.set({
            rankings: r.rankings.map((entry, i) => ({
              ...entry,
              rank: entry.rank ?? i + 1,
            })),
            questionResults: [],
            participantNames: r.rankings.map((e) => e.participant_name),
          });
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }
}
