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
  templateUrl: './game-results.component.html',
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
