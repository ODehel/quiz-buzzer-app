import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { GameService } from './game.service';
import type { PagedResponse } from '../core/models/api.models';
import type { Game, CreateGameDto, GameResults } from '../core/models/game.models';

const mockGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'game-1',
  quiz_id: 'quiz-1',
  quiz_name: 'Quiz 1',
  status: 'PENDING',
  participants: [{ order: 1, name: 'Alice' }],
  created_at: '2026-03-28T10:00:00Z',
  started_at: null,
  completed_at: null,
  ...overrides,
});

const mockPagedResponse = (
  data: Game[] = [],
  overrides: Partial<PagedResponse<Game>> = {}
): PagedResponse<Game> => ({
  data,
  page: 1,
  limit: 20,
  total: data.length,
  total_pages: 1,
  ...overrides,
});

describe('GameService', () => {
  let service: GameService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(GameService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('CA-1 — calls GET /api/v1/games with default page=1 and limit=20', () => {
      service.getAll().subscribe((response) => {
        expect(response.data).toEqual([]);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/v1/games' &&
          r.params.get('page') === '1' &&
          r.params.get('limit') === '20'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPagedResponse());
    });

    it('CA-1 — calls GET /api/v1/games with custom page and limit', () => {
      service.getAll({ page: 2, limit: 10 }).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/v1/games' &&
          r.params.get('page') === '2' &&
          r.params.get('limit') === '10'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPagedResponse());
    });

    it('returns the full PagedResponse', () => {
      const games = [mockGame(), mockGame({ id: 'game-2' })];
      const response = mockPagedResponse(games, {
        total: 15,
        total_pages: 2,
      });

      service.getAll().subscribe((res) => {
        expect(res.data).toHaveLength(2);
        expect(res.total).toBe(15);
        expect(res.total_pages).toBe(2);
      });

      httpMock.expectOne((r) => r.url === '/api/v1/games').flush(response);
    });
  });

  describe('getById', () => {
    it('calls GET /api/v1/games/:id', () => {
      const game = mockGame();
      service.getById('game-1').subscribe((g) => {
        expect(g).toEqual(game);
      });

      const req = httpMock.expectOne('/api/v1/games/game-1');
      expect(req.request.method).toBe('GET');
      req.flush(game);
    });
  });

  describe('getActive', () => {
    it('returns the first non-completed, non-error game', () => {
      const games = [
        mockGame({ id: 'g1', status: 'COMPLETED' }),
        mockGame({ id: 'g2', status: 'PENDING' }),
      ];

      service.getActive().subscribe((g) => {
        expect(g?.id).toBe('g2');
      });

      httpMock
        .expectOne((r) => r.url === '/api/v1/games')
        .flush(mockPagedResponse(games));
    });

    it('returns null when no active game', () => {
      service.getActive().subscribe((g) => {
        expect(g).toBeNull();
      });

      httpMock
        .expectOne((r) => r.url === '/api/v1/games')
        .flush(
          mockPagedResponse([mockGame({ status: 'COMPLETED' })])
        );
    });
  });

  describe('getRecent', () => {
    it('calls GET /api/v1/games with page=1 and the given limit', () => {
      const mockGames = [mockGame()];
      service.getRecent(4).subscribe((games) => {
        expect(games).toEqual(mockGames);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/v1/games' &&
          r.params.get('page') === '1' &&
          r.params.get('limit') === '4'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPagedResponse(mockGames));
    });

    it('returns the data array from the paged response', () => {
      service.getRecent(4).subscribe((games) => {
        expect(games).toEqual([]);
      });

      httpMock
        .expectOne((r) => r.url === '/api/v1/games')
        .flush(mockPagedResponse());
    });
  });

  describe('getCount', () => {
    it('calls GET /api/v1/games with page=1 and limit=1', () => {
      service.getCount().subscribe((count) => {
        expect(count).toBe(42);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/v1/games' &&
          r.params.get('page') === '1' &&
          r.params.get('limit') === '1'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPagedResponse([], { total: 42 }));
    });
  });

  describe('getResults', () => {
    it('calls GET /api/v1/games/:id/results', () => {
      const results: GameResults = {
        game_id: 'game-1',
        quiz_name: 'Quiz 1',
        started_at: '2026-03-28T10:00:00Z',
        completed_at: '2026-03-28T10:30:00Z',
        rankings: [
          {
            rank: 1,
            participant_name: 'Alice',
            participant_order: 1,
            cumulative_score: 100,
            total_time_ms: 5000,
          },
        ],
      };

      service.getResults('game-1').subscribe((r) => {
        expect(r).toEqual(results);
      });

      const req = httpMock.expectOne('/api/v1/games/game-1/results');
      expect(req.request.method).toBe('GET');
      req.flush(results);
    });
  });

  describe('create', () => {
    it('CA-24 — calls POST /api/v1/games with quiz_id and participants', async () => {
      const dto: CreateGameDto = {
        quiz_id: 'quiz-1',
        participants: ['Alice', 'Bob'],
      };
      const createdGame = mockGame({
        participants: [
          { order: 1, name: 'Alice' },
          { order: 2, name: 'Bob' },
        ],
      });

      const promise = service.create(dto);

      const req = httpMock.expectOne('/api/v1/games');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(createdGame);

      const result = await promise;
      expect(result.id).toBe('game-1');
    });
  });

  describe('start', () => {
    it('calls POST /api/v1/games/:id/start', async () => {
      const startedGame = mockGame({ status: 'OPEN' });

      const promise = service.start('game-1');

      const req = httpMock.expectOne('/api/v1/games/game-1/start');
      expect(req.request.method).toBe('POST');
      req.flush(startedGame);

      const result = await promise;
      expect(result.status).toBe('OPEN');
    });
  });

  describe('delete', () => {
    it('CA-9 — calls DELETE /api/v1/games/:id', async () => {
      const promise = service.delete('game-1');

      const req = httpMock.expectOne('/api/v1/games/game-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });
  });
});
