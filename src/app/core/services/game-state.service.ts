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
} from '../models/websocket.models';
import type { PagedResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

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

  dispatch(msg: InboundMessage): void {
    if (msg.type === 'game_state_sync') {
      this.handleGameStateSync(msg as GameStateSyncMessage);
    }
  }

  private handleGameStateSync(msg: GameStateSyncMessage): void {
    this._state.set({
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
    });
  }
}
