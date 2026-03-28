import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { GameService } from './game.service';
import type { PagedResponse } from '../core/models/api.models';
import type { Game } from '../core/models/game.models';

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

  describe('getRecent', () => {
    it('calls GET /api/v1/games with page=1 and the given limit', () => {
      const mockGames: Game[] = [
        { id: '1', quiz_id: 'q1', quiz_name: 'Quiz 1', status: 'COMPLETED', created_at: '2026-03-28T10:00:00Z', started_at: null, completed_at: null },
        { id: '2', quiz_id: 'q2', quiz_name: 'Quiz 2', status: 'PENDING', created_at: '2026-03-27T10:00:00Z', started_at: null, completed_at: null },
      ];
      const mockResponse: PagedResponse<Game> = {
        data: mockGames,
        page: 1,
        limit: 4,
        total: 10,
        total_pages: 3,
      };

      service.getRecent(4).subscribe((games) => {
        expect(games).toEqual(mockGames);
      });

      const req = httpMock.expectOne((r) =>
        r.url === '/api/v1/games' &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '4'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('returns the data array from the paged response', () => {
      const mockResponse: PagedResponse<Game> = {
        data: [],
        page: 1,
        limit: 4,
        total: 0,
        total_pages: 0,
      };

      service.getRecent(4).subscribe((games) => {
        expect(games).toEqual([]);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/v1/games');
      req.flush(mockResponse);
    });
  });

  describe('getCount', () => {
    it('calls GET /api/v1/games with page=1 and limit=1', () => {
      const mockResponse: PagedResponse<Game> = {
        data: [],
        page: 1,
        limit: 1,
        total: 42,
        total_pages: 42,
      };

      service.getCount().subscribe((count) => {
        expect(count).toBe(42);
      });

      const req = httpMock.expectOne((r) =>
        r.url === '/api/v1/games' &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '1'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('returns total from the paged response', () => {
      const mockResponse: PagedResponse<Game> = {
        data: [],
        page: 1,
        limit: 1,
        total: 0,
        total_pages: 0,
      };

      service.getCount().subscribe((count) => {
        expect(count).toBe(0);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/v1/games');
      req.flush(mockResponse);
    });
  });
});
