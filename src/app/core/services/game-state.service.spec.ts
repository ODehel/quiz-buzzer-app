import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
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
  AuthSuccessMessage,
} from '../models/websocket.models';
import { environment } from '../../../environments/environment';

describe('GameStateService', () => {
  let service: GameStateService;
  let httpMock: HttpTestingController;
  let messagesSubject: Subject<InboundMessage>;
  let routerMock: { navigate: jest.Mock; url: string };

  beforeEach(() => {
    messagesSubject = new Subject<InboundMessage>();
    routerMock = { navigate: jest.fn(), url: '/pilot/play' };

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
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(GameStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('starts with null gameId and isActive false', () => {
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
    it('calls GET /api/v1/games', async () => {
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

    it('if an active game exists, updates state', async () => {
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

    it('if no active game exists, state remains initial', async () => {
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

    it('handles network error gracefully (non-blocking)', async () => {
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
    it('CA-14 — PENDING: updates participants and buzzers', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-pending',
        status: 'PENDING',
        quiz_id: 'quiz-1',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [
          { order: 1, name: 'Alice', cumulative_score: 0 },
          { order: 2, name: 'Bob', cumulative_score: 0 },
        ],
        connected_buzzers: ['buzzer-1'],
        started_at: null,
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('PENDING');
      expect(service.state().participants).toHaveLength(2);
      expect(service.connectedBuzzers()).toEqual(['buzzer-1']);
    });

    it('CA-15 — OPEN: updates participants with cumulative scores', () => {
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
          { order: 1, name: 'Player 1', cumulative_score: 10 },
        ],
        connected_buzzers: ['buzzer-1'],
        started_at: '2026-03-28T10:00:00.000Z',
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().gameId).toBe('game-ws');
      expect(service.state().status).toBe('OPEN');
      expect(service.isActive()).toBe(true);
      expect(service.state().participants[0].cumulative_score).toBe(10);
    });

    it('CA-16 — QUESTION_TITLE: updates without started_at or time_limit', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-qt',
        status: 'QUESTION_TITLE',
        quiz_id: 'quiz-3',
        question_index: 2,
        question_type: 'MCQ',
        question_title: 'What is 2+2?',
        choices: null,
        participants: [{ order: 1, name: 'Alice', cumulative_score: 10 }],
        connected_buzzers: ['buzzer-1'],
        started_at: null,
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('QUESTION_TITLE');
      expect(service.state().remainingSeconds).toBeNull();
    });

    it('CA-16 — QUESTION_CLOSED: displays correction without timer', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-qc',
        status: 'QUESTION_CLOSED',
        quiz_id: 'quiz-3',
        question_index: 2,
        question_type: 'MCQ',
        question_title: 'What is 2+2?',
        choices: ['1', '2', '3', '4'],
        participants: [{ order: 1, name: 'Alice', cumulative_score: 10 }],
        connected_buzzers: ['buzzer-1'],
        started_at: null,
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('QUESTION_CLOSED');
      expect(service.state().remainingSeconds).toBeNull();
    });

    it('CA-17 — QUESTION_OPEN with started_at: recalculates remaining with computeRemaining', () => {
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();

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
        started_at: tenSecondsAgo,
        time_limit: 30,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('QUESTION_OPEN');
      // ~20 seconds remaining (30 - 10)
      expect(service.state().remainingSeconds).toBeCloseTo(20, 0);
    });

    it('CA-17 — QUESTION_BUZZED with started_at: recalculates remaining', () => {
      const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();

      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-buzz',
        status: 'QUESTION_BUZZED',
        quiz_id: 'quiz-3',
        question_index: 1,
        question_type: 'SPEED',
        question_title: 'Speed Q',
        choices: null,
        participants: [{ order: 1, name: 'Alice', cumulative_score: 0 }],
        connected_buzzers: ['buzzer-1'],
        started_at: fiveSecondsAgo,
        time_limit: 15,
      };

      service.dispatch(syncMsg);

      expect(service.state().remainingSeconds).toBeCloseTo(10, 0);
    });

    it('CA-18 — COMPLETED: status is set to COMPLETED', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-done',
        status: 'COMPLETED',
        quiz_id: 'quiz-3',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [{ order: 1, name: 'Alice', cumulative_score: 30 }],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('COMPLETED');
    });

    it('CA-19 — IN_ERROR: status is set to IN_ERROR', () => {
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-err',
        status: 'IN_ERROR',
        quiz_id: 'quiz-3',
        question_index: 1,
        question_type: 'MCQ',
        question_title: 'Q',
        choices: null,
        participants: [{ order: 1, name: 'Alice', cumulative_score: 10 }],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      };

      service.dispatch(syncMsg);

      expect(service.state().status).toBe('IN_ERROR');
      expect(service.isActive()).toBe(false);
    });

    it('CA-20 — startSyncTimeout triggers syncInitial if no game_state_sync arrives', async () => {
      jest.useFakeTimers();
      service.startSyncTimeout();

      jest.advanceTimersByTime(2000);

      // The timeout fired, which calls syncInitial (async)
      jest.useRealTimers();

      // Allow the HTTP call to be made
      await Promise.resolve();

      const req = httpMock.expectOne(`${environment.serverUrl}/api/v1/games`);
      req.flush({
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      });

      // Allow the promise chain to complete
      await Promise.resolve();
      await Promise.resolve();

      // No active game + on /pilot page → redirect to dashboard
      expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('CA-20 — clearSyncTimeout cancels the timeout', async () => {
      jest.useFakeTimers();
      service.startSyncTimeout();
      service.clearSyncTimeout();

      jest.advanceTimersByTime(2000);
      jest.useRealTimers();

      await Promise.resolve();

      httpMock.expectNone(`${environment.serverUrl}/api/v1/games`);
    });

    it('CA-20 — auth_success starts sync timeout, game_state_sync clears it', async () => {
      jest.useFakeTimers();
      service.dispatch({ type: 'auth_success', expires_in: 3600 } as AuthSuccessMessage);

      // game_state_sync arrives before timeout
      service.dispatch({
        type: 'game_state_sync',
        game_id: 'game-1',
        status: 'OPEN',
        quiz_id: 'quiz-1',
        question_index: null,
        question_type: null,
        question_title: null,
        choices: null,
        participants: [],
        connected_buzzers: [],
        started_at: null,
        time_limit: null,
      } as GameStateSyncMessage);

      jest.advanceTimersByTime(2000);
      jest.useRealTimers();

      await Promise.resolve();

      // No REST call should be made since game_state_sync cleared the timeout
      httpMock.expectNone(`${environment.serverUrl}/api/v1/games`);
    });

    it('preserves questionResults across reconnection', () => {
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
    it('sets status to QUESTION_TITLE with title, index, timeLimit', () => {
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

    it('resets question state on new question_title', () => {
      service.dispatch({
        type: 'player_answered',
        participant_name: 'Alice',
        participant_order: 1,
        choice: 'A',
        response_time_ms: 1000,
      } as PlayerAnsweredMessage);

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
    it('sets status to QUESTION_OPEN with choices and startedAt', () => {
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
    it('sets status to QUESTION_OPEN with SPEED type', () => {
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

    it('resets question state on question_open', () => {
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
    it('sets timerEnded to true and remainingSeconds to 0', () => {
      service.dispatch({ type: 'timer_end' } as TimerEndMessage);

      expect(service.state().timerEnded).toBe(true);
      expect(service.state().remainingSeconds).toBe(0);
    });

    it('canCorrect becomes true when timerEnded', () => {
      service.dispatch({ type: 'timer_end' } as TimerEndMessage);

      expect(service.canCorrect()).toBe(true);
    });
  });

  describe('dispatch() — player_answered', () => {
    it('adds answer to playerAnswers', () => {
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

    it('accumulates multiple answers', () => {
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
    it('sets allAnswered to true', () => {
      service.dispatch({ type: 'all_answered' } as AllAnsweredMessage);

      expect(service.state().allAnswered).toBe(true);
    });

    it('canCorrect becomes true when allAnswered', () => {
      service.dispatch({ type: 'all_answered' } as AllAnsweredMessage);

      expect(service.canCorrect()).toBe(true);
    });
  });

  describe('dispatch() — buzz_locked', () => {
    it('sets status to QUESTION_BUZZED and stores currentBuzzer', () => {
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
    it('resets to QUESTION_OPEN, clears currentBuzzer, adds invalidated player', () => {
      service.dispatch({
        type: 'buzz_locked',
        participant_name: 'Alice',
        participant_order: 1,
      } as BuzzLockedMessage);

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

    it('accumulates invalidated players', () => {
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

    it('sets status to QUESTION_CLOSED and updates participants', () => {
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

    it('accumulates questionResults for buildResults()', () => {
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

    it('SPEED result summary updates participants and scores', () => {
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
    it('sets ranking signal', () => {
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
    it('sets ranking to null', () => {
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
    it('sets state from a Game object with PENDING status', () => {
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
    it('dispatches game_state_sync received via messages$', () => {
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
