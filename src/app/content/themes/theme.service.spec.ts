import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ThemeService } from './theme.service';
import type { Theme } from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_THEME: Theme = {
  id: 't1',
  name: 'Culture',
  created_at: '2026-01-15T10:00:00Z',
};

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- getAll ---

  describe('getAll', () => {
    it('calls GET /api/v1/themes with page=1&limit=100', () => {
      const mockResponse: PagedResponse<Theme> = {
        data: [MOCK_THEME],
        page: 1,
        limit: 100,
        total: 1,
        total_pages: 1,
      };

      service.getAll().subscribe((res) => {
        expect(res.data).toHaveLength(1);
        expect(res.total).toBe(1);
        expect(res.data[0].name).toBe('Culture');
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/themes' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('100');
      req.flush(mockResponse);
    });
  });

  // --- create ---

  describe('create', () => {
    it('calls POST /api/v1/themes with { name }', async () => {
      const promise = service.create('Sport');

      const req = httpMock.expectOne('/api/v1/themes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Sport' });
      req.flush({ id: 't2', name: 'Sport', created_at: '2026-03-28T12:00:00Z' });

      const result = await promise;
      expect(result.name).toBe('Sport');
    });

    it('throws on 409 THEME_ALREADY_EXISTS', async () => {
      const promise = service.create('Culture');

      const req = httpMock.expectOne('/api/v1/themes');
      req.flush(
        { error: 'THEME_ALREADY_EXISTS', message: 'Theme already exists' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toMatchObject({ status: 409 });
    });
  });

  // --- update ---

  describe('update', () => {
    it('calls PUT /api/v1/themes/:id with { name }', async () => {
      const promise = service.update('t1', 'Culture generale');

      const req = httpMock.expectOne('/api/v1/themes/t1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Culture generale' });
      req.flush({ id: 't1', name: 'Culture generale', created_at: '2026-01-15T10:00:00Z' });

      const result = await promise;
      expect(result.name).toBe('Culture generale');
    });

    it('throws on 409 THEME_ALREADY_EXISTS', async () => {
      const promise = service.update('t1', 'Sport');

      const req = httpMock.expectOne('/api/v1/themes/t1');
      req.flush(
        { error: 'THEME_ALREADY_EXISTS', message: 'Theme already exists' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toMatchObject({ status: 409 });
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('calls DELETE /api/v1/themes/:id', async () => {
      const promise = service.delete('t1');

      const req = httpMock.expectOne('/api/v1/themes/t1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });

    it('throws on 409 THEME_HAS_QUESTIONS', async () => {
      const promise = service.delete('t1');

      const req = httpMock.expectOne('/api/v1/themes/t1');
      req.flush(
        { error: 'THEME_HAS_QUESTIONS', message: 'Theme has questions' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toMatchObject({ status: 409 });
    });
  });
});
