import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { WebSocketService } from './websocket.service';
import type { Game } from '../models/game.models';
import type {
  GameStatus,
  QuestionType,
  ParticipantState,
  RankingEntry,
  InboundMessage,
  GameStateSyncMessage,
  QuestionTitleMessage,
  QuestionChoicesMessage,
  QuestionOpenMessage,
  TimerTickMessage,
  PlayerAnsweredMessage,
  BuzzLockedMessage,
  BuzzUnlockedMessage,
  QuestionResultSummaryMessage,
  IntermediateRankingMessage,
  McqPlayerResult,
  SpeedPlayerResult,
} from '../models/websocket.models';
import type { PagedResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

export interface PlayerAnswer {
  participant_name: string;
  participant_order: number;
  choice: string;
  response_time_ms: number;
}

export interface QuestionResult {
  question_index: number;
  question_type: QuestionType;
  correct_answer: string;
  results: McqPlayerResult[] | SpeedPlayerResult[];
  ranking: RankingEntry[];
}

export interface GameState {
  gameId: string | null;
  status: GameStatus | null;
  quizId: string | null;
  questionIndex: number | null;
  questionType: QuestionType | null;
  questionTitle: string | null;
  choices: [string, string, string, string] | null;
  participants: ParticipantState[];
  connectedBuzzers: string[];
  startedAt: string | null;
  timeLimit: number | null;
  totalQuestions: number | null;
  remainingSeconds: number | null;
  timerEnded: boolean;
  playerAnswers: PlayerAnswer[];
  allAnswered: boolean;
  currentBuzzer: string | null;
  ranking: RankingEntry[] | null;
  questionResults: QuestionResult[];
  invalidatedPlayers: string[];
}

const INITIAL_STATE: GameState = {
  gameId: null,
  status: null,
  quizId: null,
  questionIndex: null,
  questionType: null,
  questionTitle: null,
  choices: null,
  participants: [],
  connectedBuzzers: [],
  startedAt: null,
  timeLimit: null,
  totalQuestions: null,
  remainingSeconds: null,
  timerEnded: false,
  playerAnswers: [],
  allAnswered: false,
  currentBuzzer: null,
  ranking: null,
  questionResults: [],
  invalidatedPlayers: [],
};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly http = inject(HttpClient);
  private readonly ws = inject(WebSocketService);
  private readonly _state = signal<GameState>(INITIAL_STATE);

  readonly state = this._state.asReadonly();
  readonly status = computed(() => this._state().status);
  readonly isActive = computed(() => {
    const s = this._state().status;
    return s !== null && s !== 'COMPLETED' && s !== 'IN_ERROR';
  });
  readonly isPiloting = computed(
    () => this.isActive() || this.status() === 'PENDING'
  );
  readonly connectedBuzzers = computed(() => this._state().connectedBuzzers);
  readonly canCorrect = computed(
    () => this._state().allAnswered || this._state().timerEnded
  );

  constructor() {
    this.ws.messages$.subscribe((msg) => this.dispatch(msg));
  }

  async syncInitial(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<PagedResponse<Game>>(
          `${environment.serverUrl}/api/v1/games`
        )
      );
      const activeGame = response.data.find(
        (g) => g.status !== 'COMPLETED' && g.status !== 'IN_ERROR'
      );
      if (activeGame && !this._state().gameId) {
        this._state.update((s) => ({
          ...s,
          gameId: activeGame.id,
          status: activeGame.status,
          quizId: activeGame.quiz_id,
          startedAt: activeGame.started_at,
        }));
      }
    } catch {
      // Non-blocking: the app can work without initial sync
    }
  }

  initFromGame(game: Game): void {
    this._state.update(() => ({
      ...INITIAL_STATE,
      gameId: game.id,
      status: 'PENDING',
      quizId: game.quiz_id,
      participants: game.participants.map((p) => ({
        order: p.order,
        name: p.name,
        cumulative_score: 0,
      })),
    }));
  }

  reset(): void {
    this._state.set(INITIAL_STATE);
  }

  dismissRanking(): void {
    this._state.update((s) => ({ ...s, ranking: null }));
  }

  buildResults(): QuestionResult[] {
    return this._state().questionResults;
  }

  dispatch(msg: InboundMessage): void {
    switch (msg.type) {
      case 'game_state_sync':
        this.handleGameStateSync(msg as GameStateSyncMessage);
        break;
      case 'question_title':
        this.handleQuestionTitle(msg as QuestionTitleMessage);
        break;
      case 'question_choices':
        this.handleQuestionChoices(msg as QuestionChoicesMessage);
        break;
      case 'question_open':
        this.handleQuestionOpen(msg as QuestionOpenMessage);
        break;
      case 'timer_tick':
        this.handleTimerTick(msg as TimerTickMessage);
        break;
      case 'timer_end':
        this.handleTimerEnd();
        break;
      case 'player_answered':
        this.handlePlayerAnswered(msg as PlayerAnsweredMessage);
        break;
      case 'all_answered':
        this.handleAllAnswered();
        break;
      case 'buzz_locked':
        this.handleBuzzLocked(msg as BuzzLockedMessage);
        break;
      case 'buzz_unlocked':
        this.handleBuzzUnlocked(msg as BuzzUnlockedMessage);
        break;
      case 'question_result_summary':
        this.handleQuestionResultSummary(msg as QuestionResultSummaryMessage);
        break;
      case 'intermediate_ranking':
        this.handleIntermediateRanking(msg as IntermediateRankingMessage);
        break;
    }
  }

  private handleGameStateSync(msg: GameStateSyncMessage): void {
    this._state.set({
      ...INITIAL_STATE,
      gameId: msg.game_id,
      status: msg.status,
      quizId: msg.quiz_id,
      questionIndex: msg.question_index,
      questionType: msg.question_type,
      questionTitle: msg.question_title,
      choices: msg.choices,
      participants: msg.participants,
      connectedBuzzers: msg.connected_buzzers,
      startedAt: msg.started_at,
      timeLimit: msg.time_limit,
      questionResults: this._state().questionResults,
    });
  }

  private handleQuestionTitle(msg: QuestionTitleMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_TITLE' as GameStatus,
      questionIndex: msg.question_index,
      questionType: msg.question_type,
      questionTitle: msg.title,
      timeLimit: msg.time_limit,
      totalQuestions: msg.total_questions,
      choices: null,
      startedAt: null,
      remainingSeconds: null,
      timerEnded: false,
      playerAnswers: [],
      allAnswered: false,
      currentBuzzer: null,
      invalidatedPlayers: [],
    }));
  }

  private handleQuestionChoices(msg: QuestionChoicesMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_OPEN' as GameStatus,
      choices: msg.choices,
      startedAt: msg.started_at,
      timerEnded: false,
      playerAnswers: [],
      allAnswered: false,
    }));
  }

  private handleQuestionOpen(msg: QuestionOpenMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_OPEN' as GameStatus,
      questionIndex: msg.question_index,
      questionType: msg.question_type,
      questionTitle: msg.title,
      timeLimit: msg.time_limit,
      totalQuestions: msg.total_questions,
      startedAt: msg.started_at,
      choices: null,
      remainingSeconds: null,
      timerEnded: false,
      playerAnswers: [],
      allAnswered: false,
      currentBuzzer: null,
      invalidatedPlayers: [],
    }));
  }

  private handleTimerTick(msg: TimerTickMessage): void {
    this._state.update((s) => ({
      ...s,
      remainingSeconds: msg.remaining_seconds,
    }));
  }

  private handleTimerEnd(): void {
    this._state.update((s) => ({
      ...s,
      timerEnded: true,
      remainingSeconds: 0,
    }));
  }

  private handlePlayerAnswered(msg: PlayerAnsweredMessage): void {
    this._state.update((s) => ({
      ...s,
      playerAnswers: [
        ...s.playerAnswers,
        {
          participant_name: msg.participant_name,
          participant_order: msg.participant_order,
          choice: msg.choice,
          response_time_ms: msg.response_time_ms,
        },
      ],
    }));
  }

  private handleAllAnswered(): void {
    this._state.update((s) => ({ ...s, allAnswered: true }));
  }

  private handleBuzzLocked(msg: BuzzLockedMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_BUZZED' as GameStatus,
      currentBuzzer: msg.participant_name,
    }));
  }

  private handleBuzzUnlocked(msg: BuzzUnlockedMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_OPEN' as GameStatus,
      currentBuzzer: null,
      remainingSeconds: msg.remaining_seconds,
      timerEnded: false,
      invalidatedPlayers: [...s.invalidatedPlayers, msg.invalidated_participant],
    }));
  }

  private handleQuestionResultSummary(msg: QuestionResultSummaryMessage): void {
    this._state.update((s) => ({
      ...s,
      status: 'QUESTION_CLOSED' as GameStatus,
      participants: msg.ranking.map((r) => ({
        order: r.participant_order,
        name: r.participant_name,
        cumulative_score: r.cumulative_score,
      })),
      questionResults: [
        ...s.questionResults,
        {
          question_index: msg.question_index,
          question_type: msg.question_type,
          correct_answer: msg.correct_answer,
          results: msg.results,
          ranking: msg.ranking,
        },
      ],
    }));
  }

  private handleIntermediateRanking(msg: IntermediateRankingMessage): void {
    this._state.update((s) => ({ ...s, ranking: msg.ranking }));
  }
}
