import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { SoundService } from './sound.service';
import type { Sound } from '../../core/models/sound.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_SOUND: Sound = {
  id: 's1',
  name: 'Fanfare',
  filename: 'fanfare.mp3',
  url: '/uploads/fanfare.mp3',
  created_at: '2026-03-01T10:00:00.000Z',
};

describe('SoundService', () => {
  let service: SoundService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SoundService],
    });
    service = TestBed.inject(SoundService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- getAll ---

  describe('getAll', () => {
    it('calls GET /api/v1/sounds with page and limit params', () => {
      const mockResponse: PagedResponse<Sound> = {
        data: [MOCK_SOUND],
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      };

      service.getAll({ page: 1, limit: 20 }).subscribe((res) => {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].name).toBe('Fanfare');
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/sounds' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush(mockResponse);
    });

    it('calls GET /api/v1/sounds without params when none provided', () => {
      service.getAll().subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/sounds' && r.method === 'GET'
      );
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush({ data: [], page: 1, limit: 20, total: 0, total_pages: 0 });
    });

    it('calls GET /api/v1/sounds with limit=100 for panel usage', () => {
      service.getAll({ limit: 100 }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/sounds' && r.method === 'GET'
      );
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.has('page')).toBe(false);
      req.flush({ data: [], page: 1, limit: 100, total: 0, total_pages: 0 });
    });
  });

  // --- upload ---

  describe('upload', () => {
    it('calls POST /api/v1/sounds with multipart/form-data containing name and file', async () => {
      const file = new File(['audio-data'], 'test.mp3', { type: 'audio/mpeg' });

      const promise = service.upload('Mon jingle', file);

      const req = httpMock.expectOne('/api/v1/sounds');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      expect(req.request.body.get('name')).toBe('Mon jingle');
      expect(req.request.body.get('file')).toBeTruthy();
      req.flush(MOCK_SOUND, { status: 201, statusText: 'Created' });

      const result = await promise;
      expect(result.name).toBe('Fanfare');
    });

    it('rejects with 409 when sound already exists', async () => {
      const file = new File(['audio-data'], 'test.mp3', { type: 'audio/mpeg' });

      const promise = service.upload('Fanfare', file);

      const req = httpMock.expectOne('/api/v1/sounds');
      req.flush(
        { error: 'SOUND_ALREADY_EXISTS', message: 'Sound already exists' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toMatchObject({ status: 409 });
    });

    it('rejects with 413 when file is too large', async () => {
      const file = new File(['audio-data'], 'big.mp3', { type: 'audio/mpeg' });

      const promise = service.upload('Big file', file);

      const req = httpMock.expectOne('/api/v1/sounds');
      req.flush(
        { error: 'FILE_TOO_LARGE', message: 'File too large' },
        { status: 413, statusText: 'Payload Too Large' }
      );

      await expect(promise).rejects.toMatchObject({ status: 413 });
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('calls DELETE /api/v1/sounds/:id', async () => {
      const promise = service.delete('s1');

      const req = httpMock.expectOne('/api/v1/sounds/s1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });

    it('rejects on server error', async () => {
      const promise = service.delete('s1');

      const req = httpMock.expectOne('/api/v1/sounds/s1');
      req.flush(
        { error: 'INTERNAL_ERROR', message: 'Internal error' },
        { status: 500, statusText: 'Internal Server Error' }
      );

      await expect(promise).rejects.toMatchObject({ status: 500 });
    });
  });
});
