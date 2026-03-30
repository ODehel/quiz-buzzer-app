import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Subject } from 'rxjs';

import { GameCreateComponent } from './game-create.component';
import { GameStateService } from '../core/services/game-state.service';
import { WebSocketService } from '../core/services/websocket.service';
import type { InboundMessage, GameStateSyncMessage } from '../core/models/websocket.models';
import type { Quiz, QuizDetail } from '../core/models/quiz.models';
import type { PagedResponse } from '../core/models/api.models';

@Component({ template: '' })
class DummyComponent {}

const mockQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-1',
  name: 'Mon Quiz',
  created_at: '2026-03-28T10:00:00Z',
  last_updated_at: null,
  question_summary: {
    total: 5,
    by_level: { '1': { MCQ: 3, SPEED: 2 } },
  },
  ...overrides,
});

const mockQuizDetail = (overrides: Partial<QuizDetail> = {}): QuizDetail => ({
  id: 'quiz-1',
  name: 'Mon Quiz',
  question_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
  created_at: '2026-03-28T10:00:00Z',
  last_updated_at: null,
  ...overrides,
});

function flushQuizLoad(
  httpMock: HttpTestingController,
  quizzes: Quiz[] = [mockQuiz()]
): void {
  const req = httpMock.expectOne(
    (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
  );
  req.flush({
    data: quizzes,
    page: 1,
    limit: 100,
    total: quizzes.length,
    total_pages: 1,
  } as PagedResponse<Quiz>);
}

describe('GameCreateComponent', () => {
  let fixture: ComponentFixture<GameCreateComponent>;
  let component: GameCreateComponent;
  let httpMock: HttpTestingController;
  let router: Router;
  let gs: GameStateService;
  let messagesSubject: Subject<InboundMessage>;

  beforeEach(() => {
    messagesSubject = new Subject<InboundMessage>();

    TestBed.configureTestingModule({
      imports: [GameCreateComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'games', component: DummyComponent },
          { path: 'pilot/lobby', component: DummyComponent },
          { path: 'pilot/play', component: DummyComponent },
          { path: 'content/quizzes/new', component: DummyComponent },
        ]),
        {
          provide: WebSocketService,
          useValue: {
            messages$: messagesSubject.asObservable(),
            send: jest.fn(),
          },
        },
      ],
    });

    gs = TestBed.inject(GameStateService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndFlush(quizzes: Quiz[] = [mockQuiz()]): void {
    fixture = TestBed.createComponent(GameCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushQuizLoad(httpMock, quizzes);
    fixture.detectChanges();
  }

  it('CA-13 — calls GET /api/v1/quizzes?limit=100 on load', () => {
    createAndFlush();

    const select = fixture.nativeElement.querySelector('[data-testid="quiz-select"]');
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(2);
  });

  it('CA-14 — redirects to /pilot/play if isPiloting is true', () => {
    gs.dispatch({
      type: 'game_state_sync',
      game_id: 'active',
      status: 'PENDING',
      quiz_id: 'q1',
      question_index: null,
      question_type: null,
      question_title: null,
      choices: null,
      participants: [],
      connected_buzzers: [],
      started_at: null,
      time_limit: null,
    } as GameStateSyncMessage);

    fixture = TestBed.createComponent(GameCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });

  it('CA-15 — quiz select has disabled default option', () => {
    createAndFlush();

    const select = fixture.nativeElement.querySelector('[data-testid="quiz-select"]');
    const defaultOption = select.options[0];
    expect(defaultOption.disabled).toBe(true);
    expect(defaultOption.textContent).toContain('Sélectionner un quiz');
  });

  it('CA-16 — loads quiz preview on selection', fakeAsync(() => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    tick();

    const previewReq = httpMock.expectOne('/api/v1/quizzes/quiz-1');
    expect(previewReq.request.method).toBe('GET');
    previewReq.flush(mockQuizDetail());
    tick();
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('[data-testid="quiz-preview"]');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('questions');
    expect(preview.querySelector('.preview-stat-val')?.textContent?.trim()).toBe('5');
  }));

  it('CA-17 — displays empty message when no quizzes available', () => {
    createAndFlush([]);

    const noQuizzes = fixture.nativeElement.querySelector('[data-testid="no-quizzes"]');
    expect(noQuizzes).toBeTruthy();
    expect(noQuizzes.textContent).toContain('Aucun quiz disponible');
  });

  it('CA-17 — shows link to create quiz when no quizzes', () => {
    createAndFlush([]);

    const link = fixture.nativeElement.querySelector('[data-testid="no-quizzes"] a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/content/quizzes/new');
  });

  it('CA-18 — starts with one empty participant', () => {
    createAndFlush();

    const inputs = fixture.nativeElement.querySelectorAll('[data-testid="participant-input"]');
    expect(inputs.length).toBe(1);
    expect(inputs[0].value).toBe('');
  });

  it('CA-18 — add button adds a participant up to 10', () => {
    createAndFlush();

    for (let i = 0; i < 9; i++) {
      component.onAddParticipant();
    }
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('[data-testid="participant-input"]');
    expect(inputs.length).toBe(10);

    const addBtn = fixture.nativeElement.querySelector('[data-testid="btn-add-participant"]');
    expect(addBtn).toBeFalsy();
  });

  it('CA-19 — isValid is false with empty participant', () => {
    createAndFlush();
    expect(component.isValid()).toBe(false);
  });

  it('CA-20 — validates unique participant names (case-insensitive)', () => {
    createAndFlush();

    component.onParticipantChange(0, 'Alice');
    component.onAddParticipant();
    component.onParticipantChange(1, 'alice');
    fixture.detectChanges();

    expect(component.isValid()).toBe(false);

    const errors = fixture.nativeElement.querySelectorAll('[data-testid="field-error"]');
    const errorTexts = Array.from(errors).map((e: any) => e.textContent.trim());
    expect(errorTexts.some((t: string) => t.includes('déjà utilisé'))).toBe(true);
  });

  it('CA-21 — remove button disabled when only one participant', () => {
    createAndFlush();

    const removeBtn = fixture.nativeElement.querySelector('[data-testid="btn-remove-participant"]');
    expect(removeBtn.disabled).toBe(true);
  });

  it('CA-21 — remove button removes a participant', () => {
    createAndFlush();

    component.onAddParticipant();
    component.onParticipantChange(0, 'Alice');
    component.onParticipantChange(1, 'Bob');
    fixture.detectChanges();

    component.onRemoveParticipant(0);
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('[data-testid="participant-input"]');
    expect(inputs.length).toBe(1);
  });

  it('CA-22 — displays participant counter', () => {
    createAndFlush();

    const counter = fixture.nativeElement.querySelector('[data-testid="participant-counter"]');
    expect(counter.textContent.trim()).toBe('1 / 10');
  });

  it('CA-23 — submit button disabled when no quiz selected', () => {
    createAndFlush();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="btn-submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('CA-23 — submit button disabled when participants invalid', fakeAsync(() => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    const previewReq = httpMock.expectOne('/api/v1/quizzes/quiz-1');
    previewReq.flush(mockQuizDetail());
    tick();
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="btn-submit"]');
    expect(submitBtn.disabled).toBe(true);
  }));

  it('CA-24/CA-25 — creates game, calls initFromGame, navigates to lobby', async () => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    const previewReq = httpMock.expectOne('/api/v1/quizzes/quiz-1');
    previewReq.flush(mockQuizDetail());
    await fixture.whenStable();

    component.onParticipantChange(0, 'Alice');
    fixture.detectChanges();

    jest.spyOn(gs, 'initFromGame');

    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const createReq = httpMock.expectOne('/api/v1/games');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      quiz_id: 'quiz-1',
      participants: ['Alice'],
    });
    createReq.flush({
      id: 'new-game',
      quiz_id: 'quiz-1',
      quiz_name: 'Mon Quiz',
      status: 'PENDING',
      participants: [{ order: 1, name: 'Alice' }],
      created_at: '2026-03-28T10:00:00Z',
      started_at: null,
      completed_at: null,
    });
    await fixture.whenStable();

    expect(gs.initFromGame).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/pilot/lobby']);
  });

  it('CA-26 — shows error toast on 409 ACTIVE_GAME_EXISTS', async () => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    httpMock.expectOne('/api/v1/quizzes/quiz-1').flush(mockQuizDetail());
    await fixture.whenStable();

    component.onParticipantChange(0, 'Alice');
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const createReq = httpMock.expectOne('/api/v1/games');
    createReq.flush(
      { error: 'ACTIVE_GAME_EXISTS', message: 'An active game exists' },
      { status: 409, statusText: 'Conflict' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast.textContent).toContain('Une partie est déjà en cours');

    const link = fixture.nativeElement.querySelector('[data-testid="resume-link"]');
    expect(link).toBeTruthy();
  });

  it('CA-27 — shows error toast on 404 QUIZ_NOT_FOUND and reloads quizzes', async () => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    httpMock.expectOne('/api/v1/quizzes/quiz-1').flush(mockQuizDetail());
    await fixture.whenStable();

    component.onParticipantChange(0, 'Alice');
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const createReq = httpMock.expectOne('/api/v1/games');
    createReq.flush(
      { error: 'QUIZ_NOT_FOUND', message: 'Quiz not found' },
      { status: 404, statusText: 'Not Found' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast.textContent).toContain('Le quiz sélectionné n\'existe plus');

    // Verify quizzes are reloaded
    const reloadReq = httpMock.expectOne(
      (r) => r.url === '/api/v1/quizzes' && r.method === 'GET'
    );
    reloadReq.flush({
      data: [],
      page: 1,
      limit: 100,
      total: 0,
      total_pages: 0,
    });
    await fixture.whenStable();
  });

  it('CA-28 — shows generic error toast on 500', async () => {
    createAndFlush();

    component.onQuizSelect('quiz-1');
    httpMock.expectOne('/api/v1/quizzes/quiz-1').flush(mockQuizDetail());
    await fixture.whenStable();

    component.onParticipantChange(0, 'Alice');
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const createReq = httpMock.expectOne('/api/v1/games');
    createReq.flush(
      { error: 'INTERNAL_ERROR', message: 'Server error' },
      { status: 500, statusText: 'Internal Server Error' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast.textContent).toContain('Erreur lors de la création');
    expect(router.navigate).not.toHaveBeenCalledWith(['/pilot/lobby']);
  });
});
