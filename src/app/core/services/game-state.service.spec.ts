import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Subject } from 'rxjs';

import { GameStateService } from './game-state.service';
import { WebSocketService } from './websocket.service';
import type {
  InboundMessage,
  GameStateSyncMessage,
  QuestionTitleMessage,
  QuestionChoicesMessage,
  QuestionOpenMessage,
  TimerTickMessage,
  TimerEndMessage,
  PlayerAnsweredMessage,
  AllAnsweredMessage,
  BuzzLockedMessage,
  BuzzUnlockedMessage,
  QuestionResultSummaryMessage,
  IntermediateRankingMessage,
  RankingEntry,
} from '../models/websocket.models';
import { environment } from '../../../environments/environment';

describe('GameStateService', () => {
  let service: GameStateService;
  let httpMock: HttpTestingController;
  let messagesSubject: Subject<InboundMessage>;

  beforeEach(() => {
    messagesSubject = new Subject<InboundMessage>();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GameStateService,
        {
          provide: WebSocketService,
          useValue: {
            messages$: messagesSubject.asObservable(),
            send: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(GameStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('CA-19 — starts with null gameId and isActive false', () => {
      expect(service.state().gameId).toBeNull();
      expect(service.state().status).toBeNull();
      expect(service.isActive()).toBe(false);
      expect(service.isPiloting()).toBe(false);
    });

    it('starts with empty questionResults', () => {
      expect(service.state().questionResults).toEqual([]);
    });

    it('starts with canCorrect false', () => {
      expect(service.canCorrect()).toBe(false);
    });
  });

  describe('syncInitial()', () => {
    it('CA-17 — calls GET /api/v1/games', async () => {
      const syncPromise = service.syncInitial();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/games`
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      });
      await syncPromise;
    });

    it('CA-18 — if an active game exists, updates state', async () => {
      const syncPromise = service.syncInitial();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/games`
      );
      req.flush({
        data: [
          {
            id: 'game-1',
            quiz_id: 'quiz-1',
            status: 'PENDING',
            created_at: '2026-03-28T10:00:00.000Z',
            started_at: null,
            completed_at: null,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      });
      await syncPromise;

      expect(service.state().gameId).toBe('game-1');
      expect(service.state().status).toBe('PENDING');
      expect(service.isPiloting()).toBe(true);
    });

    it('CA-19 — if no active game exists, state remains initial', async () => {
      const syncPromise = service.syncInitial();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/games`
      );
      req.flush({
        data: [
          {
            id: 'game-old',
            quiz_id: 'quiz-1',
            status: 'COMPLETED',
            created_at: '2026-03-28T10:00:00.000Z',
            started_at: '2026-03-28T10:05:00.000Z',
            completed_at: '2026-03-28T10:30:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      });
      await syncPromise;

      expect(service.state().gameId).toBeNull();
      expect(service.isActive()).toBe(false);
    });

    it('CA-17 — handles network error gracefully (non-blocking)', async () => {
      const syncPromise = service.syncInitial();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/games`
      );
      req.error(new ProgressEvent('Network error'));

      await syncPromise; // Should not throw
      expect(service.state().gameId).toBeNull();
    });
  });

  describe('dispatch() — game_state_sync', () => {
    it('CA-20 — game_state_sync updates the full state', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-ws',
        status: 'OPEN',
        quiz_id: 'quiz-2',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [
          { order: 1, name: 'Player 1', cumulative_score: 0 },
        ],
        connected_buzzers: ['buzzer-1'],
        started_at: '2026-03-28T10:00:00.000Z',
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().gameId).toBe('game-ws');
      expect(service.state().status).toBe('OPEN');
      expect(service.isActive()).toBe(true);
      expect(service.connectedBuzzers()).toEqual(['buzzer-1']);
    });

    it('CA-48 — game_state_sync restores state on reconnection', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-reconnect',
        status: 'QUESTION_OPEN',
        quiz_id: 'quiz-3',
        question_index: 2,
        question_type: 'MCQ',
        question_title: 'What is 2+2?',
        choices: ['1', '2', '3', '4'],
        participants: [{ order: 1, name: 'Alice', cumulative_score: 10 }],
        connected_buzzers: ['buzzer-1'],
        started_at: '2026-03-28T10:00:00.000Z',
        time_limit: 30,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('QUESTION_OPEN');
      expect(service.state().questionIndex).toBe(2);
      expect(service.state().questionType).toBe('MCQ');
      expect(service.state().choices).toEqual(['1', '2', '3', '4']);
      expect(service.state().startedAt).toBe('2026-03-28T10:00:00.000Z');
      expect(service.state().timeLimit).toBe(30);
    });

    it('CA-50 — game_state_sync preserves questionResults', () => {
      // First, add a question result
      const resultMsg: QuestionResultSummaryMessage = {
        type: 'question_result_summary',
        question_index: 0,
        question_type: 'MCQ',
        correct_answer: 'Paris',
        results: [],
        ranking: [{ rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 10, total_time_ms: 5000 }],
      };
      service.dispatch(resultMsg);
      expect(service.state().questionResults).toHaveLength(1);

      // Now dispatch game_state_sync
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-ws',
        status: 'OPEN',
        quiz_id: 'quiz-2',
        question_index: 1,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      };
      service.dispatch(syncMsg);

      // questionResults should be preserved
      expect(service.state().questionResults).toHaveLength(1);
    });
  });

  describe('dispatch() — question_title (MCQ)', () => {
    it('CA-8 — sets status to QUESTION_TITLE with title, index, timeLimit', () => {
      const msg: QuestionTitleMessage = {
        type: 'question_title',
        question_index: 3,
        question_type: 'MCQ',
        title: 'Quelle est la capitale de la France ?',
        time_limit: 30,
        total_questions: 10,
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_TITLE');
      expect(service.state().questionIndex).toBe(3);
      expect(service.state().questionType).toBe('MCQ');
      expect(service.state().questionTitle).toBe('Quelle est la capitale de la France ?');
      expect(service.state().timeLimit).toBe(30);
      expect(service.state().totalQuestions).toBe(10);
    });

    it('CA-8 — resets question state on new question_title', () => {
      // Set some previous state
      service.dispatch({
        type: 'player_answered',
        participant_name: 'Alice',
        participant_order: 1,
        choice: 'A',
        response_time_ms: 1000,
      } as PlayerAnsweredMessage);

      // Now receive new question
      service.dispatch({
        type: 'question_title',
        question_index: 1,
        question_type: 'MCQ',
        title: 'New question',
        time_limit: 20,
        total_questions: 5,
      } as QuestionTitleMessage);

      expect(service.state().playerAnswers).toEqual([]);
      expect(service.state().allAnswered).toBe(false);
      expect(service.state().timerEnded).toBe(false);
      expect(service.state().choices).toBeNull();
      expect(service.state().currentBuzzer).toBeNull();
    });
  });

  describe('dispatch() — question_choices', () => {
    it('CA-11 — sets status to QUESTION_OPEN with choices and startedAt', () => {
      const msg: QuestionChoicesMessage = {
        type: 'question_choices',
        choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
        started_at: '2026-03-28T10:01:00.000Z',
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_OPEN');
      expect(service.state().choices).toEqual(['Paris', 'Lyon', 'Marseille', 'Toulouse']);
      expect(service.state().startedAt).toBe('2026-03-28T10:01:00.000Z');
    });
  });

  describe('dispatch() — question_open (SPEED)', () => {
    it('CA-23 — sets status to QUESTION_OPEN with SPEED type', () => {
      const msg: QuestionOpenMessage = {
        type: 'question_open',
        question_index: 2,
        question_type: 'SPEED',
        title: 'Qui a peint la Joconde ?',
        time_limit: 15,
        total_questions: 10,
        started_at: '2026-03-28T10:02:00.000Z',
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_OPEN');
      expect(service.state().questionType).toBe('SPEED');
      expect(service.state().questionTitle).toBe('Qui a peint la Joconde ?');
      expect(service.state().startedAt).toBe('2026-03-28T10:02:00.000Z');
      expect(service.state().timeLimit).toBe(15);
      expect(service.state().totalQuestions).toBe(10);
    });

    it('CA-23 — resets question state on question_open', () => {
      service.dispatch({
        type: 'question_open',
        question_index: 0,
        question_type: 'SPEED',
        title: 'Test',
        time_limit: 10,
        total_questions: 5,
        started_at: '2026-03-28T10:00:00.000Z',
      } as QuestionOpenMessage);

      expect(service.state().currentBuzzer).toBeNull();
      expect(service.state().invalidatedPlayers).toEqual([]);
      expect(service.state().playerAnswers).toEqual([]);
    });
  });

  describe('dispatch() — timer_tick', () => {
    it('updates remainingSeconds', () => {
      const msg: TimerTickMessage = {
        type: 'timer_tick',
        remaining_seconds: 25,
      };

      service.dispatch(msg);

      expect(service.state().remainingSeconds).toBe(25);
    });
  });

  describe('dispatch() — timer_end', () => {
    it('CA-15 — sets timerEnded to true and remainingSeconds to 0', () => {
      service.dispatch({ type: 'timer_end' } as TimerEndMessage);

      expect(service.state().timerEnded).toBe(true);
      expect(service.state().remainingSeconds).toBe(0);
    });

    it('CA-15 — canCorrect becomes true when timerEnded', () => {
      service.dispatch({ type: 'timer_end' } as TimerEndMessage);

      expect(service.canCorrect()).toBe(true);
    });
  });

  describe('dispatch() — player_answered', () => {
    it('CA-12 — adds answer to playerAnswers', () => {
      const msg: PlayerAnsweredMessage = {
        type: 'player_answered',
        participant_name: 'Alice',
        participant_order: 1,
        choice: 'A',
        response_time_ms: 2500,
      };

      service.dispatch(msg);

      expect(service.state().playerAnswers).toHaveLength(1);
      expect(service.state().playerAnswers[0]).toEqual({
        participant_name: 'Alice',
        participant_order: 1,
        choice: 'A',
        response_time_ms: 2500,
      });
    });

    it('CA-12 — accumulates multiple answers', () => {
      service.dispatch({
        type: 'player_answered',
        participant_name: 'Alice',
        participant_order: 1,
        choice: 'A',
        response_time_ms: 2500,
      } as PlayerAnsweredMessage);

      service.dispatch({
        type: 'player_answered',
        participant_name: 'Bob',
        participant_order: 2,
        choice: 'B',
        response_time_ms: 3000,
      } as PlayerAnsweredMessage);

      expect(service.state().playerAnswers).toHaveLength(2);
    });
  });

  describe('dispatch() — all_answered', () => {
    it('CA-14 — sets allAnswered to true', () => {
      service.dispatch({ type: 'all_answered' } as AllAnsweredMessage);

      expect(service.state().allAnswered).toBe(true);
    });

    it('CA-14 — canCorrect becomes true when allAnswered', () => {
      service.dispatch({ type: 'all_answered' } as AllAnsweredMessage);

      expect(service.canCorrect()).toBe(true);
    });
  });

  describe('dispatch() — buzz_locked', () => {
    it('CA-26 — sets status to QUESTION_BUZZED and stores currentBuzzer', () => {
      const msg: BuzzLockedMessage = {
        type: 'buzz_locked',
        participant_name: 'Alice',
        participant_order: 1,
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_BUZZED');
      expect(service.state().currentBuzzer).toBe('Alice');
    });
  });

  describe('dispatch() — buzz_unlocked', () => {
    it('CA-30 — resets to QUESTION_OPEN, clears currentBuzzer, adds invalidated player', () => {
      // First buzz
      service.dispatch({
        type: 'buzz_locked',
        participant_name: 'Alice',
        participant_order: 1,
      } as BuzzLockedMessage);

      // Invalidate
      const msg: BuzzUnlockedMessage = {
        type: 'buzz_unlocked',
        remaining_seconds: 12,
        invalidated_participant: 'Alice',
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_OPEN');
      expect(service.state().currentBuzzer).toBeNull();
      expect(service.state().remainingSeconds).toBe(12);
      expect(service.state().timerEnded).toBe(false);
      expect(service.state().invalidatedPlayers).toContain('Alice');
    });

    it('CA-30 — accumulates invalidated players', () => {
      service.dispatch({
        type: 'buzz_locked',
        participant_name: 'Alice',
        participant_order: 1,
      } as BuzzLockedMessage);
      service.dispatch({
        type: 'buzz_unlocked',
        remaining_seconds: 12,
        invalidated_participant: 'Alice',
      } as BuzzUnlockedMessage);

      service.dispatch({
        type: 'buzz_locked',
        participant_name: 'Bob',
        participant_order: 2,
      } as BuzzLockedMessage);
      service.dispatch({
        type: 'buzz_unlocked',
        remaining_seconds: 8,
        invalidated_participant: 'Bob',
      } as BuzzUnlockedMessage);

      expect(service.state().invalidatedPlayers).toEqual(['Alice', 'Bob']);
    });
  });

  describe('dispatch() — question_result_summary', () => {
    const ranking: RankingEntry[] = [
      { rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 10, total_time_ms: 5000 },
      { rank: 2, participant_name: 'Bob', participant_order: 2, cumulative_score: 5, total_time_ms: 8000 },
    ];

    it('CA-18/CA-20 — sets status to QUESTION_CLOSED and updates participants', () => {
      const msg: QuestionResultSummaryMessage = {
        type: 'question_result_summary',
        question_index: 0,
        question_type: 'MCQ',
        correct_answer: 'Paris',
        results: [
          { participant_name: 'Alice', participant_order: 1, choice: 'Paris', correct: true, response_time_ms: 5000, points_earned: 10 },
          { participant_name: 'Bob', participant_order: 2, choice: 'Lyon', correct: false, response_time_ms: 8000, points_earned: 0 },
        ],
        ranking,
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_CLOSED');
      expect(service.state().participants).toEqual([
        { order: 1, name: 'Alice', cumulative_score: 10 },
        { order: 2, name: 'Bob', cumulative_score: 5 },
      ]);
    });

    it('CA-42 — accumulates questionResults for buildResults()', () => {
      const msg1: QuestionResultSummaryMessage = {
        type: 'question_result_summary',
        question_index: 0,
        question_type: 'MCQ',
        correct_answer: 'Paris',
        results: [],
        ranking,
      };

      const msg2: QuestionResultSummaryMessage = {
        type: 'question_result_summary',
        question_index: 1,
        question_type: 'SPEED',
        correct_answer: 'Da Vinci',
        results: [],
        ranking,
      };

      service.dispatch(msg1);
      service.dispatch(msg2);

      expect(service.state().questionResults).toHaveLength(2);
      expect(service.buildResults()).toHaveLength(2);
      expect(service.buildResults()[0].question_type).toBe('MCQ');
      expect(service.buildResults()[1].question_type).toBe('SPEED');
    });

    it('CA-32/CA-33 — SPEED result summary updates participants and scores', () => {
      const msg: QuestionResultSummaryMessage = {
        type: 'question_result_summary',
        question_index: 0,
        question_type: 'SPEED',
        correct_answer: 'Leonardo da Vinci',
        results: [
          { participant_name: 'Alice', participant_order: 1, winner: true, points_earned: 10 },
          { participant_name: 'Bob', participant_order: 2, winner: false, points_earned: 0 },
        ],
        ranking,
      };

      service.dispatch(msg);

      expect(service.status()).toBe('QUESTION_CLOSED');
      expect(service.state().participants[0].cumulative_score).toBe(10);
    });
  });

  describe('dispatch() — intermediate_ranking', () => {
    it('CA-37 — sets ranking signal', () => {
      const ranking: RankingEntry[] = [
        { rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 20, total_time_ms: 10000 },
      ];

      service.dispatch({
        type: 'intermediate_ranking',
        ranking,
      } as IntermediateRankingMessage);

      expect(service.state().ranking).toEqual(ranking);
    });
  });

  describe('dismissRanking()', () => {
    it('CA-39 — sets ranking to null', () => {
      service.dispatch({
        type: 'intermediate_ranking',
        ranking: [
          { rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 20, total_time_ms: 10000 },
        ],
      } as IntermediateRankingMessage);

      expect(service.state().ranking).not.toBeNull();

      service.dismissRanking();

      expect(service.state().ranking).toBeNull();
    });
  });

  describe('initFromGame()', () => {
    it('CA-25 — sets state from a Game object with PENDING status', () => {
      service.initFromGame({
        id: 'game-new',
        quiz_id: 'quiz-1',
        quiz_name: 'Test Quiz',
        status: 'PENDING',
        participants: [
          { order: 1, name: 'Alice' },
          { order: 2, name: 'Bob' },
        ],
        created_at: '2026-03-28T10:00:00Z',
        started_at: null,
        completed_at: null,
      });

      expect(service.state().gameId).toBe('game-new');
      expect(service.state().status).toBe('PENDING');
      expect(service.state().quizId).toBe('quiz-1');
      expect(service.state().participants).toEqual([
        { order: 1, name: 'Alice', cumulative_score: 0 },
        { order: 2, name: 'Bob', cumulative_score: 0 },
      ]);
      expect(service.isPiloting()).toBe(true);
    });
  });

  describe('reset()', () => {
    it('resets state to initial', () => {
      service.dispatch({
        type: 'game_state_sync',
        game_id: 'game-x',
        status: 'OPEN',
        quiz_id: 'quiz-x',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      } as GameStateSyncMessage);

      service.reset();

      expect(service.state().gameId).toBeNull();
      expect(service.state().status).toBeNull();
      expect(service.isActive()).toBe(false);
    });
  });

  describe('via messages$ subscription', () => {
    it('CA-8/CA-20 — dispatches game_state_sync received via messages$', () => {
      messagesSubject.next({
        type: 'game_state_sync',
        game_id: 'game-sub',
        status: 'PENDING',
        quiz_id: 'quiz-sub',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      } as GameStateSyncMessage);

      expect(service.state().gameId).toBe('game-sub');
    });

    it('dispatches question_title received via messages$', () => {
      messagesSubject.next({
        type: 'question_title',
        question_index: 0,
        question_type: 'MCQ',
        title: 'Test via messages$',
        time_limit: 30,
        total_questions: 5,
      } as QuestionTitleMessage);

      expect(service.status()).toBe('QUESTION_TITLE');
      expect(service.state().questionTitle).toBe('Test via messages$');
    });

    it('dispatches all message types via messages$', () => {
      messagesSubject.next({
        type: 'question_open',
        question_index: 0,
        question_type: 'SPEED',
        title: 'Speed Q',
        time_limit: 15,
        total_questions: 3,
        started_at: '2026-03-28T10:00:00.000Z',
      } as QuestionOpenMessage);

      expect(service.status()).toBe('QUESTION_OPEN');
      expect(service.state().questionType).toBe('SPEED');
    });
  });

  describe('unknown message types', () => {
    it('does not throw on unknown message type', () => {
      expect(() => {
        service.dispatch({ type: 'unknown_type' } as any);
      }).not.toThrow();
    });

    it('does not change state on unknown message type', () => {
      const stateBefore = service.state();
      service.dispatch({ type: 'unknown_type' } as any);
      expect(service.state()).toEqual(stateBefore);
    });
  });
});
