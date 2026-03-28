import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { signal, computed } from '@angular/core';
import { NEVER, Subject } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { GameStateService, GameState } from '../core/services/game-state.service';
import { WebSocketService } from '../core/services/websocket.service';
import { GameService } from '../games/game.service';
import { QuizService } from '../content/quizzes/quiz.service';
import { QuestionService } from '../content/questions/question.service';
import type { Game } from '../core/models/game.models';
import type { GameStatus, InboundMessage } from '../core/models/websocket.models';
import { of, throwError } from 'rxjs';

const INITIAL_STATE: GameState = {
  gameId: null,
  status: null,
  quizId: null,
  questionIndex: null,
  questionType: null,
  questionTitle: null,
  choices: null,
  participants: [],
  connectedBuzzers: [],
  startedAt: null,
  timeLimit: null,
};

function createMockGameStateService(overrides: Partial<GameState> = {}) {
  const state = { ...INITIAL_STATE, ...overrides };
  const _state = signal<GameState>(state);
  const statusSig = computed(() => _state().status);
  const isActiveSig = computed(() => {
    const s = _state().status;
    return s !== null && s !== 'COMPLETED' && s !== 'IN_ERROR';
  });
  const isPilotingSig = computed(() => isActiveSig() || statusSig() === 'PENDING');
  const connectedBuzzersSig = computed(() => _state().connectedBuzzers);

  return {
    state: _state.asReadonly(),
    status: statusSig,
    isActive: isActiveSig,
    isPiloting: isPilotingSig,
    connectedBuzzers: connectedBuzzersSig,
    _state,
  };
}

function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: '1',
    quiz_id: 'q1',
    quiz_name: 'Mon Quiz',
    status: 'COMPLETED' as GameStatus,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let httpMock: HttpTestingController;
  let router: Router;
  let mockGs: ReturnType<typeof createMockGameStateService>;
  let mockGameService: { getRecent: jest.Mock; getCount: jest.Mock };
  let mockQuizService: { getCount: jest.Mock };
  let mockQuestionService: { getCount: jest.Mock };

  function setup(gsOverrides: Partial<GameState> = {}, options?: {
    games?: Game[] | null;
    quizCount?: number | null;
    questionCount?: number | null;
    gameCount?: number | null;
  }) {
    mockGs = createMockGameStateService(gsOverrides);
    const opts = {
      games: [] as Game[],
      quizCount: 5,
      questionCount: 20,
      gameCount: 10,
      ...options,
    };

    mockGameService = {
      getRecent: jest.fn().mockReturnValue(opts.games === null ? throwError(() => new Error('fail')) : of(opts.games)),
      getCount: jest.fn().mockReturnValue(opts.gameCount === null ? throwError(() => new Error('fail')) : of(opts.gameCount)),
    };
    mockQuizService = {
      getCount: jest.fn().mockReturnValue(opts.quizCount === null ? throwError(() => new Error('fail')) : of(opts.quizCount)),
    };
    mockQuestionService = {
      getCount: jest.fn().mockReturnValue(opts.questionCount === null ? throwError(() => new Error('fail')) : of(opts.questionCount)),
    };

    TestBed.configureTestingModule({
      imports: [DashboardComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: GameStateService, useValue: mockGs },
        { provide: WebSocketService, useValue: { messages$: NEVER, send: jest.fn(), isConnected: signal(true), isReconnecting: signal(false) } },
        { provide: GameService, useValue: mockGameService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: QuestionService, useValue: mockQuestionService },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();

    // Flush the health check call
    const healthReq = httpMock.match('/api/v1/health');
    healthReq.forEach((r) => r.flush({ status: 'ok', version: '1.2.3' }));
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock?.verify();
  });

  // CA-1: GET /api/v1/games?page=1&limit=4 is called at load
  it('CA-1: calls gameService.getRecent(4) on init', () => {
    setup();
    expect(mockGameService.getRecent).toHaveBeenCalledWith(4);
  });

  // CA-2: quizzes and questions counts are called in parallel via forkJoin
  it('CA-2: calls quizService.getCount and questionService.getCount in parallel', () => {
    setup();
    expect(mockQuizService.getCount).toHaveBeenCalled();
    expect(mockQuestionService.getCount).toHaveBeenCalled();
  });

  // CA-3: 4 metrics displayed (buzzers, quiz, questions, games)
  it('CA-3: displays 4 metrics — buzzers, quiz count, question count, game count', () => {
    setup({}, { quizCount: 5, questionCount: 20, gameCount: 10 });
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="metric-buzzers"]').textContent.trim()).toBe('0');
    expect(el.querySelector('[data-testid="metric-quizzes"]').textContent.trim()).toBe('5');
    expect(el.querySelector('[data-testid="metric-questions"]').textContent.trim()).toBe('20');
    expect(el.querySelector('[data-testid="metric-games"]').textContent.trim()).toBe('10');
  });

  // CA-4: loading state shown while data is loading
  it('CA-4: shows loading indicator when isLoading is true', () => {
    mockGs = createMockGameStateService();
    mockGameService = {
      getRecent: jest.fn().mockReturnValue(NEVER),
      getCount: jest.fn().mockReturnValue(NEVER),
    };
    mockQuizService = { getCount: jest.fn().mockReturnValue(NEVER) };
    mockQuestionService = { getCount: jest.fn().mockReturnValue(NEVER) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DashboardComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: GameStateService, useValue: mockGs },
        { provide: WebSocketService, useValue: { messages$: NEVER, send: jest.fn(), isConnected: signal(true), isReconnecting: signal(false) } },
        { provide: GameService, useValue: mockGameService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: QuestionService, useValue: mockQuestionService },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="loading"]')).toBeTruthy();

    // Flush pending health request to satisfy httpMock.verify()
    const healthReq = httpMock.match('/api/v1/health');
    healthReq.forEach((r) => r.flush({ status: 'ok' }));
  });

  // CA-5: On REST error, metrics show '—'
  it('CA-5: displays — for metrics that fail to load', () => {
    setup({}, { quizCount: null, questionCount: null, gameCount: null });
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="metric-quizzes"]').textContent.trim()).toBe('—');
    expect(el.querySelector('[data-testid="metric-questions"]').textContent.trim()).toBe('—');
    expect(el.querySelector('[data-testid="metric-games"]').textContent.trim()).toBe('—');
  });

  // CA-6: Active game banner shown when isPiloting is true
  it('CA-6: shows active banner when isPiloting is true', () => {
    setup({ status: 'OPEN', gameId: 'g1', quizId: 'quiz-abc' });
    const banner = fixture.nativeElement.querySelector('[data-testid="active-banner"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Partie en cours');
  });

  // CA-7: No banner when isPiloting is false
  it('CA-7: hides active banner when isPiloting is false', () => {
    setup();
    expect(fixture.nativeElement.querySelector('[data-testid="active-banner"]')).toBeNull();
  });

  // CA-8: Resume piloting button navigates to correct route based on status
  it('CA-8: resume button links to /pilot/lobby for PENDING', () => {
    setup({ status: 'PENDING', gameId: 'g1' });
    const link = fixture.nativeElement.querySelector('[data-testid="resume-piloting"]');
    expect(link.getAttribute('href')).toBe('/pilot/lobby');
  });

  it('CA-8: resume button links to /pilot/play for OPEN', () => {
    setup({ status: 'OPEN', gameId: 'g1' });
    const link = fixture.nativeElement.querySelector('[data-testid="resume-piloting"]');
    expect(link.getAttribute('href')).toBe('/pilot/play');
  });

  it('CA-8: resume button links to /pilot/play for QUESTION_OPEN', () => {
    setup({ status: 'QUESTION_OPEN', gameId: 'g1' });
    const link = fixture.nativeElement.querySelector('[data-testid="resume-piloting"]');
    expect(link.getAttribute('href')).toBe('/pilot/play');
  });

  // CA-10: Buzzer metric reflects connectedBuzzers signal
  it('CA-10: buzzer metric reflects connectedBuzzers count', () => {
    setup({ connectedBuzzers: ['alice', 'bob'] });
    expect(fixture.nativeElement.querySelector('[data-testid="metric-buzzers"]').textContent.trim()).toBe('2');
  });

  // CA-11: Buzzer names truncated at 3
  it('CA-11: buzzer names truncated to 3 with +N suffix', () => {
    setup({ connectedBuzzers: ['alice', 'bob', 'charlie', 'dave', 'eve'] });
    const names = fixture.nativeElement.querySelector('[data-testid="buzzer-names"]').textContent.trim();
    expect(names).toBe('alice, bob, charlie +2');
  });

  it('CA-11: shows all buzzer names when 3 or fewer', () => {
    setup({ connectedBuzzers: ['alice', 'bob'] });
    const names = fixture.nativeElement.querySelector('[data-testid="buzzer-names"]').textContent.trim();
    expect(names).toBe('alice, bob');
  });

  // CA-13: Recent games listed with quiz name, status, date
  it('CA-13: displays recent games with quiz name and status', () => {
    const games = [
      createMockGame({ id: '1', quiz_name: 'Quiz A', status: 'COMPLETED' }),
      createMockGame({ id: '2', quiz_name: 'Quiz B', status: 'PENDING' }),
    ];
    setup({}, { games });
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="games-table"] tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Quiz A');
    expect(rows[1].textContent).toContain('Quiz B');
  });

  // CA-14: "Voir" link for COMPLETED games goes to /games/:id/results
  it('CA-14: game link goes to /games/:id/results for COMPLETED', () => {
    const games = [createMockGame({ id: 'g1', status: 'COMPLETED' })];
    setup({}, { games });
    const link = fixture.nativeElement.querySelector('[data-testid="game-link"]');
    expect(link.getAttribute('href')).toBe('/games/g1/results');
  });

  // CA-15: "Voir" link for OPEN/QUESTION_* goes to /pilot/play
  it('CA-15: game link goes to /pilot/play for OPEN', () => {
    const games = [createMockGame({ id: 'g1', status: 'OPEN' })];
    setup({}, { games });
    const link = fixture.nativeElement.querySelector('[data-testid="game-link"]');
    expect(link.getAttribute('href')).toBe('/pilot/play');
  });

  // CA-16: "Voir" link for PENDING goes to /pilot/lobby
  it('CA-16: game link goes to /pilot/lobby for PENDING', () => {
    const games = [createMockGame({ id: 'g1', status: 'PENDING' })];
    setup({}, { games });
    const link = fixture.nativeElement.querySelector('[data-testid="game-link"]');
    expect(link.getAttribute('href')).toBe('/pilot/lobby');
  });

  // CA-17: "Nouvelle partie" button always present
  it('CA-17: new game button is always visible', () => {
    setup();
    const btn = fixture.nativeElement.querySelector('.btn--primary');
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toBe('Nouvelle partie');
  });

  // CA-18: When piloting, new game click shows toast and does not navigate
  it('CA-18: shows toast when clicking new game during active game', fakeAsync(() => {
    setup({ status: 'OPEN', gameId: 'g1' });
    const navigateSpy = jest.spyOn(router, 'navigate');
    const btn = fixture.nativeElement.querySelector('.btn--primary');
    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="toast"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="toast"]').textContent).toContain('Une partie est déjà en cours');
    expect(navigateSpy).not.toHaveBeenCalled();
    tick(4000);
  }));

  // CA-19: When not piloting, new game click navigates to /games/new
  it('CA-19: navigates to /games/new when no active game', () => {
    setup();
    const navigateSpy = jest.spyOn(router, 'navigate');
    const btn = fixture.nativeElement.querySelector('.btn--primary');
    btn.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/games/new']);
  });

  // CA-25: Health check called and version displayed
  it('CA-25: displays server version from health check', () => {
    setup();
    const versionEl = fixture.nativeElement.querySelector('[data-testid="server-version"]');
    expect(versionEl).toBeTruthy();
    expect(versionEl.textContent).toContain('1.2.3');
  });
});
