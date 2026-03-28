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
import type { InboundMessage, GameStateSyncMessage } from '../models/websocket.models';
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

  describe('dispatch()', () => {
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

    it('CA-20 — game_state_sync takes precedence over syncInitial()', async () => {
      // WebSocket delivers game_state_sync before HTTP responds
      const syncMsg: GameStateSyncMessage = {
        type: 'game_state_sync',
        game_id: 'game-ws-fresh',
        status: 'QUESTION_OPEN',
        quiz_id: 'quiz-3',
        question_index: 2,
        question_type: 'MCQ',
        question_title: 'What is 2+2?',
        choices: ['1', '2', '3', '4'],
        participants: [],
        connected_buzzers: [],
        started_at: '2026-03-28T10:00:00.000Z',
        time_limit: 30,
      };
      service.dispatch(syncMsg);

      // Start syncInitial after WS data arrived
      const syncPromise = service.syncInitial();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/games`
      );
      req.flush({
        data: [
          {
            id: 'game-rest-old',
            quiz_id: 'quiz-2',
            status: 'PENDING',
            created_at: '2026-03-28T09:00:00.000Z',
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

      // WebSocket data should take precedence (gameId already set, so syncInitial skips update)
      expect(service.state().gameId).toBe('game-ws-fresh');
      expect(service.state().status).toBe('QUESTION_OPEN');
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
  });
});
