import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { QuizService } from './quiz.service';
import type {
  Quiz,
  QuizDetail,
  CreateQuizDto,
  QuizCreateResponse,
} from '../../core/models/quiz.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_QUIZ: Quiz = {
  id: 'qz1',
  name: 'Culture generale saison 1',
  created_at: '2026-03-01T10:00:00.000Z',
  last_updated_at: null,
  question_summary: {
    total: 12,
    by_level: {
      '1': { MCQ: 2, SPEED: 1 },
      '2': { MCQ: 3, SPEED: 2 },
      '3': { MCQ: 2, SPEED: 2 },
    },
  },
};

const MOCK_QUIZ_DETAIL: QuizDetail = {
  id: 'qz1',
  name: 'Culture generale saison 1',
  question_ids: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
  created_at: '2026-03-01T10:00:00.000Z',
  last_updated_at: null,
};

describe('QuizService', () => {
  let service: QuizService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QuizService],
    });
    service = TestBed.inject(QuizService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- getAll ---

  describe('getAll', () => {
    it('calls GET /api/v1/quizzes with page and limit params', () => {
      const mockResponse: PagedResponse<Quiz> = {
        data: [MOCK_QUIZ],
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
        (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush(mockResponse);
    });

    it('includes name filter param when provided', () => {
      service.getAll({ page: 1, limit: 20, name: 'culture' }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
      );
      expect(req.request.params.get('name')).toBe('culture');
      req.flush({ data: [], page: 1, limit: 20, total: 0, total_pages: 0 });
    });

    it('does not include name param when not provided', () => {
      service.getAll({ page: 1, limit: 20 }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
      );
      expect(req.request.params.has('name')).toBe(false);
      req.flush({ data: [], page: 1, limit: 20, total: 0, total_pages: 0 });
    });
  });

  // --- getById ---

  describe('getById', () => {
    it('calls GET /api/v1/quizzes/:id', () => {
      service.getById('qz1').subscribe((q) => {
        expect(q.id).toBe('qz1');
        expect(q.question_ids).toHaveLength(10);
      });

      const req = httpMock.expectOne('/api/v1/quizzes/qz1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_QUIZ_DETAIL);
    });
  });

  // --- getCount ---

  describe('getCount', () => {
    it('calls GET /api/v1/quizzes with page=1&limit=1 and returns total', () => {
      service.getCount().subscribe((count) => {
        expect(count).toBe(5);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('1');
      req.flush({ data: [], page: 1, limit: 1, total: 5, total_pages: 5 });
    });
  });

  // --- create ---

  describe('create', () => {
    it('calls POST /api/v1/quizzes with the DTO', async () => {
      const dto: CreateQuizDto = {
        name: 'Mon nouveau quiz',
        question_ids: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
      };

      const promise = service.create(dto);

      const req = httpMock.expectOne('/api/v1/quizzes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({
        id: 'qz2',
        name: 'Mon nouveau quiz',
        question_count: 10,
        created_at: '2026-03-01T10:00:00.000Z',
        last_updated_at: null,
      });

      const result = await promise;
      expect(result.name).toBe('Mon nouveau quiz');
      expect(result.question_count).toBe(10);
    });
  });

  // --- update ---

  describe('update', () => {
    it('calls PUT /api/v1/quizzes/:id with the DTO', async () => {
      const dto: CreateQuizDto = {
        name: 'Quiz renomme',
        question_ids: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
      };

      const promise = service.update('qz1', dto);

      const req = httpMock.expectOne('/api/v1/quizzes/qz1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({
        id: 'qz1',
        name: 'Quiz renomme',
        question_count: 10,
        created_at: '2026-03-01T10:00:00.000Z',
        last_updated_at: '2026-03-02T10:00:00.000Z',
      });

      const result = await promise;
      expect(result.name).toBe('Quiz renomme');
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('calls DELETE /api/v1/quizzes/:id', async () => {
      const promise = service.delete('qz1');

      const req = httpMock.expectOne('/api/v1/quizzes/qz1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });

    it('throws on 403 QUIZ_IN_USE', async () => {
      const promise = service.delete('qz1');

      const req = httpMock.expectOne('/api/v1/quizzes/qz1');
      req.flush(
        { error: 'QUIZ_IN_USE', message: 'Quiz in use' },
        { status: 403, statusText: 'Forbidden' }
      );

      await expect(promise).rejects.toMatchObject({
        status: 403,
      });
    });
  });
});
