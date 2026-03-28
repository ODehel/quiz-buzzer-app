import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { QuestionService } from './question.service';
import type {
  Question,
  CreateQuestionDto,
  PatchQuestionDto,
  MediaUploadResponse,
} from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_QUESTION: Question = {
  id: 'q1',
  type: 'MCQ',
  theme_id: 't1',
  theme_name: 'Culture',
  title: 'Quelle est la capitale de la France ?',
  choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
  correct_answer: 'Paris',
  level: 3,
  time_limit: 30,
  points: 200,
  image_path: null,
  audio_path: null,
  created_at: '2026-01-01T00:00:00Z',
  last_updated_at: '2026-01-01T00:00:00Z',
};

describe('QuestionService', () => {
  let service: QuestionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QuestionService],
    });
    service = TestBed.inject(QuestionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- getAll ---

  describe('getAll', () => {
    it('calls GET /api/v1/questions with page and limit params', () => {
      const mockResponse: PagedResponse<Question> = {
        data: [MOCK_QUESTION],
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      };

      service.getAll({ page: 1, limit: 20 }).subscribe((res) => {
        expect(res.data).toHaveLength(1);
        expect(res.total).toBe(1);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/questions' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush(mockResponse);
    });

    it('includes filter params when provided', () => {
      service
        .getAll({
          page: 2,
          limit: 10,
          theme_id: 't1',
          type: 'MCQ',
          level_min: 1,
          level_max: 5,
          points_min: 100,
          points_max: 400,
        })
        .subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/questions' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.get('theme_id')).toBe('t1');
      expect(req.request.params.get('type')).toBe('MCQ');
      expect(req.request.params.get('level_min')).toBe('1');
      expect(req.request.params.get('level_max')).toBe('5');
      expect(req.request.params.get('points_min')).toBe('100');
      expect(req.request.params.get('points_max')).toBe('400');
      req.flush({ data: [], page: 2, limit: 10, total: 0, total_pages: 0 });
    });

    it('does not include undefined filter params', () => {
      service.getAll({ page: 1, limit: 20 }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/questions' && r.method === 'GET'
      );
      expect(req.request.params.has('theme_id')).toBe(false);
      expect(req.request.params.has('type')).toBe(false);
      expect(req.request.params.has('level_min')).toBe(false);
      expect(req.request.params.has('level_max')).toBe(false);
      req.flush({ data: [], page: 1, limit: 20, total: 0, total_pages: 0 });
    });
  });

  // --- getById ---

  describe('getById', () => {
    it('calls GET /api/v1/questions/:id', () => {
      service.getById('q1').subscribe((q) => {
        expect(q.id).toBe('q1');
        expect(q.title).toBe(MOCK_QUESTION.title);
      });

      const req = httpMock.expectOne('/api/v1/questions/q1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_QUESTION);
    });
  });

  // --- getCount ---

  describe('getCount', () => {
    it('calls GET /api/v1/questions with page=1&limit=1 and returns total', () => {
      service.getCount().subscribe((count) => {
        expect(count).toBe(42);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/questions' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('1');
      req.flush({ data: [], page: 1, limit: 1, total: 42, total_pages: 42 });
    });
  });

  // --- create ---

  describe('create', () => {
    it('calls POST /api/v1/questions with the DTO', async () => {
      const dto: CreateQuestionDto = {
        type: 'MCQ',
        theme_id: 't1',
        title: 'New question',
        choices: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        level: 2,
        time_limit: 30,
        points: 100,
      };

      const promise = service.create(dto);

      const req = httpMock.expectOne('/api/v1/questions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ ...MOCK_QUESTION, id: 'q2', title: 'New question' });

      const result = await promise;
      expect(result.title).toBe('New question');
    });
  });

  // --- patch ---

  describe('patch', () => {
    it('calls PATCH /api/v1/questions/:id with only changed fields', async () => {
      const changes: PatchQuestionDto = { title: 'Updated title' };

      const promise = service.patch('q1', changes);

      const req = httpMock.expectOne('/api/v1/questions/q1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ title: 'Updated title' });
      req.flush({ ...MOCK_QUESTION, title: 'Updated title' });

      const result = await promise;
      expect(result.title).toBe('Updated title');
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('calls DELETE /api/v1/questions/:id', async () => {
      const promise = service.delete('q1');

      const req = httpMock.expectOne('/api/v1/questions/q1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });

    it('throws on 409 QUESTION_IN_QUIZ', async () => {
      const promise = service.delete('q1');

      const req = httpMock.expectOne('/api/v1/questions/q1');
      req.flush(
        { error: 'QUESTION_IN_QUIZ', message: 'Question in quiz' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  // --- uploadMedia ---

  describe('uploadMedia', () => {
    it('calls POST /api/v1/questions/:id/media with FormData', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse: MediaUploadResponse = {
        id: 'q1',
        image_path: '/uploads/questions/q1-image.jpg',
        audio_path: null,
        last_updated_at: '2026-01-01T00:00:00Z',
      };

      const promise = service.uploadMedia('q1', 'image', file);

      const req = httpMock.expectOne('/api/v1/questions/q1/media');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      req.flush(mockResponse);

      const result = await promise;
      expect(result.image_path).toBe('/uploads/questions/q1-image.jpg');
    });
  });

  // --- deleteMedia ---

  describe('deleteMedia', () => {
    it('calls DELETE /api/v1/questions/:id/media/image', async () => {
      const promise = service.deleteMedia('q1', 'image');

      const req = httpMock.expectOne('/api/v1/questions/q1/media/image');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });

    it('calls DELETE /api/v1/questions/:id/media/audio', async () => {
      const promise = service.deleteMedia('q1', 'audio');

      const req = httpMock.expectOne('/api/v1/questions/q1/media/audio');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });
  });
});
