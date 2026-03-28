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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="results" data-testid="game-results">
      @if (isLoading()) {
        <div class="results__loading" data-testid="loading">Chargement des résultats...</div>
      } @else if (results()) {
        <!-- Podium -->
        <section class="results__podium" data-testid="podium">
          <h2>Podium</h2>
          <div class="podium">
            @for (entry of podium(); track entry.rank) {
              <div
                class="podium__entry"
                [class.podium__entry--gold]="entry.rank === 1"
                [class.podium__entry--silver]="entry.rank === 2"
                [class.podium__entry--bronze]="entry.rank === 3"
                data-testid="podium-entry"
              >
                <span class="podium__medal" data-testid="podium-medal">
                  @if (entry.rank === 1) { 🥇 }
                  @else if (entry.rank === 2) { 🥈 }
                  @else if (entry.rank === 3) { 🥉 }
                </span>
                <span class="podium__name">{{ entry.participant_name }}</span>
                <span class="podium__score">{{ entry.cumulative_score }} pts</span>
                <span class="podium__time">{{ formatTime(entry.total_time_ms) }}</span>
              </div>
            }
          </div>
        </section>

        <!-- Detail table -->
        @if (results()!.questionResults.length > 0) {
          <section class="results__detail" data-testid="detail-section">
            <h2>Détail par question</h2>
            <div class="results__table-wrapper">
              <table class="detail-table" data-testid="detail-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    @for (name of results()!.participantNames; track name) {
                      <th>{{ name }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (qr of results()!.questionResults; track qr.question_index) {
                    <tr data-testid="detail-row">
                      <td>Q{{ qr.question_index + 1 }} ({{ qr.question_type }})</td>
                      @for (name of results()!.participantNames; track name) {
                        <td
                          [class.detail-table__cell--correct]="getCellStatus(qr, name) === 'correct'"
                          [class.detail-table__cell--wrong]="getCellStatus(qr, name) === 'wrong'"
                          [class.detail-table__cell--absent]="getCellStatus(qr, name) === 'absent'"
                          data-testid="detail-cell"
                        >
                          {{ getCellLabel(qr, name) }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- Actions -->
        <div class="results__actions" data-testid="results-actions">
          <button
            class="btn btn--primary"
            (click)="onNewGame()"
            [disabled]="gs.isActive()"
            data-testid="btn-new-game"
          >
            Nouvelle partie
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .results { padding: 24px; max-width: 900px; margin: 0 auto; }
    .results__loading { text-align: center; padding: 48px; color: #6c757d; }
    .results__podium { margin-bottom: 32px; }
    .results__podium h2 { font-size: 1.25rem; margin: 0 0 16px; }
    .podium { display: flex; gap: 16px; justify-content: center; }
    .podium__entry { display: flex; flex-direction: column; align-items: center; padding: 20px 24px; border-radius: 12px; border: 2px solid #dee2e6; min-width: 150px; }
    .podium__entry--gold { border-color: #ffd700; background: #fffde7; }
    .podium__entry--silver { border-color: #c0c0c0; background: #fafafa; }
    .podium__entry--bronze { border-color: #cd7f32; background: #fff8e1; }
    .podium__medal { font-size: 2rem; }
    .podium__name { font-size: 1.1rem; font-weight: 600; margin: 4px 0; }
    .podium__score { font-size: 0.95rem; font-weight: 600; color: #0d6efd; }
    .podium__time { font-size: 0.8rem; color: #6c757d; }
    .results__detail { margin-bottom: 24px; }
    .results__detail h2 { font-size: 1.25rem; margin: 0 0 16px; }
    .results__table-wrapper { overflow-x: auto; }
    .detail-table { width: 100%; border-collapse: collapse; }
    .detail-table th, .detail-table td { padding: 8px 12px; border: 1px solid #dee2e6; text-align: center; font-size: 0.85rem; }
    .detail-table th { background: #f8f9fa; font-weight: 600; }
    .detail-table__cell--correct { background: #d4edda; color: #155724; }
    .detail-table__cell--wrong { background: #f8d7da; color: #721c24; }
    .detail-table__cell--absent { background: #f8f9fa; color: #adb5bd; }
    .results__actions { margin-top: 24px; text-align: center; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { background: #6c757d; cursor: not-allowed; }
  `],
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
      if (results.length === 0) return 'absent';
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
