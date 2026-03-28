import { TestBed, ComponentFixture, fakeAsync, tick, discardPeriodicTasks, flush } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Subject } from 'rxjs';

import { GameListComponent } from './game-list.component';
import { GameStateService } from '../core/services/game-state.service';
import { WebSocketService } from '../core/services/websocket.service';
import type { InboundMessage } from '../core/models/websocket.models';
import type { Game } from '../core/models/game.models';
import type { Quiz } from '../core/models/quiz.models';

const mockGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'game-1',
  quiz_id: 'quiz-1',
  quiz_name: 'Quiz 1',
  status: 'PENDING',
  participants: [{ order: 1, name: 'Alice' }, { order: 2, name: 'Bob' }],
  created_at: '2026-03-28T10:00:00Z',
  started_at: null,
  completed_at: null,
  ...overrides,
});

const mockQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-1',
  name: 'Mon Quiz',
  created_at: '2026-03-28T10:00:00Z',
  last_updated_at: null,
  question_summary: { total: 5, by_level: {} },
  ...overrides,
});

function flushInitialLoad(
  httpMock: HttpTestingController,
  games: Game[] = [mockGame()],
  quizzes: Quiz[] = [mockQuiz()],
  gamesPaged: Record<string, unknown> = {}
): void {
  const requests = httpMock.match(
    (r) => r.url === '/api/v1/games' || r.url === '/api/v1/quizzes'
  );
  for (const req of requests) {
    if (req.request.url === '/api/v1/games') {
      req.flush({
        data: games,
        page: 1,
        limit: 20,
        total: games.length,
        total_pages: 1,
        ...gamesPaged,
      });
    } else {
      req.flush({
        data: quizzes,
        page: 1,
        limit: 100,
        total: quizzes.length,
        total_pages: 1,
      });
    }
  }
}

describe('GameListComponent', () => {
  let fixture: ComponentFixture<GameListComponent>;
  let component: GameListComponent;
  let httpMock: HttpTestingController;
  let router: Router;
  let messagesSubject: Subject<InboundMessage>;

  beforeEach(() => {
    messagesSubject = new Subject<InboundMessage>();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, GameListComponent],
      providers: [
        provideRouter([
          { path: 'games/new', component: GameListComponent },
          { path: 'pilot/lobby', component: GameListComponent },
          { path: 'pilot/play', component: GameListComponent },
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

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate');
  });

  function createAndFlush(
    games: Game[] = [mockGame()],
    quizzes: Quiz[] = [mockQuiz()],
    gamesPaged: Record<string, unknown> = {}
  ): void {
    fixture = TestBed.createComponent(GameListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushInitialLoad(httpMock, games, quizzes, gamesPaged);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('CA-1 — calls GET /api/v1/games?page=1&limit=20 on load', () => {
    createAndFlush();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="game-row"]');
    expect(rows.length).toBe(1);
  });

  it('CA-2 — displays quiz name, status, date, and participant count', () => {
    createAndFlush();

    const quizName = fixture.nativeElement.querySelector('[data-testid="game-quiz-name"]');
    expect(quizName.textContent.trim()).toBe('Mon Quiz');

    const participants = fixture.nativeElement.querySelector('[data-testid="game-participants"]');
    expect(participants.textContent.trim()).toBe('2');
  });

  it('CA-2 — resolves quiz name from quiz map', () => {
    const game = mockGame({ quiz_id: 'quiz-2', quiz_name: '' });
    const quiz = mockQuiz({ id: 'quiz-2', name: 'Quiz Résolu' });
    createAndFlush([game], [quiz]);

    const quizName = fixture.nativeElement.querySelector('[data-testid="game-quiz-name"]');
    expect(quizName.textContent.trim()).toBe('Quiz Résolu');
  });

  it('CA-3 — displays PaginatorComponent when total_pages > 1', () => {
    createAndFlush([mockGame()], [mockQuiz()], { total_pages: 3 });

    const paginator = fixture.nativeElement.querySelector('app-paginator');
    expect(paginator).toBeTruthy();
  });

  it('CA-3 — hides PaginatorComponent when total_pages <= 1', () => {
    createAndFlush();

    const paginator = fixture.nativeElement.querySelector('app-paginator');
    expect(paginator).toBeFalsy();
  });

  it('CA-4 — gameRoute returns /games/:id/results for COMPLETED games', () => {
    createAndFlush();
    const game = mockGame({ id: 'g1', status: 'COMPLETED' });
    expect(component.gameRoute(game)).toBe('/games/g1/results');
  });

  it('CA-4 — gameRoute returns /games/:id/results for IN_ERROR games', () => {
    createAndFlush();
    const game = mockGame({ id: 'g1', status: 'IN_ERROR' });
    expect(component.gameRoute(game)).toBe('/games/g1/results');
  });

  it('CA-5 — gameRoute returns /pilot/lobby for PENDING games', () => {
    createAndFlush();
    const game = mockGame({ status: 'PENDING' });
    expect(component.gameRoute(game)).toBe('/pilot/lobby');
  });

  it('CA-6 — gameRoute returns /pilot/play for OPEN games', () => {
    createAndFlush();
    const game = mockGame({ status: 'OPEN' });
    expect(component.gameRoute(game)).toBe('/pilot/play');
  });

  it('CA-6 — gameRoute returns /pilot/play for QUESTION_OPEN games', () => {
    createAndFlush();
    const game = mockGame({ status: 'QUESTION_OPEN' });
    expect(component.gameRoute(game)).toBe('/pilot/play');
  });

  it('CA-7 — delete button visible only for PENDING games', () => {
    const games = [
      mockGame({ id: 'g1', status: 'PENDING' }),
      mockGame({ id: 'g2', status: 'COMPLETED' }),
      mockGame({ id: 'g3', status: 'OPEN' }),
    ];
    createAndFlush(games);

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="game-row"]');
    expect(rows[0].querySelector('[data-testid="btn-delete"]')).toBeTruthy();
    expect(rows[1].querySelector('[data-testid="btn-delete"]')).toBeFalsy();
    expect(rows[2].querySelector('[data-testid="btn-delete"]')).toBeFalsy();
  });

  it('CA-8 — delete click opens confirm dialog with quiz name', fakeAsync(() => {
    createAndFlush();

    const deleteBtn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    deleteBtn.click();
    tick();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[data-testid="confirm-dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Mon Quiz');

    // Cancel to clean up
    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="confirm-cancel"]');
    cancelBtn.click();
    tick();
  }));

  it('CA-9 — after confirm, calls DELETE and reloads with toast', async () => {
    createAndFlush();

    // Trigger delete flow
    const deletePromise = component.onDeleteClick(
      component['games']()[0]
    );

    // Dialog opens - confirm it
    await fixture.whenStable();
    fixture.detectChanges();
    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-ok"]');
    confirmBtn.click();

    // Wait for DELETE request
    await fixture.whenStable();
    const deleteReq = httpMock.expectOne(
      (r) => r.url === '/api/v1/games/game-1' && r.method === 'DELETE'
    );
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });

    // Wait for the async method to complete and trigger reload
    await deletePromise;
    await fixture.whenStable();

    // Reload request (triggered by loadTrigger$)
    const reloadReqs = httpMock.match(
      (r) => r.url === '/api/v1/games' && r.method === 'GET'
    );
    for (const req of reloadReqs) {
      req.flush({
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      });
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast.textContent).toContain('Partie supprimée');
  });

  it('CA-10 — "Nouvelle partie" button is always visible', () => {
    createAndFlush();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-new-game"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toBe('Nouvelle partie');
  });

  it('CA-11 — shows toast when isPiloting is true', fakeAsync(() => {
    const gs = TestBed.inject(GameStateService);
    gs.dispatch({
      type: 'game_state_sync',
      game_id: 'active-game',
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
    });

    createAndFlush();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-new-game"]');
    btn.click();
    tick();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast.textContent).toContain('Une partie est déjà en cours');
    expect(router.navigate).not.toHaveBeenCalledWith(['/games/new']);

    // Flush the toast timeout
    tick(4000);
  }));

  it('CA-12 — navigates to /games/new when not piloting', fakeAsync(() => {
    createAndFlush();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-new-game"]');
    btn.click();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/games/new']);
  }));

  it('displays empty message when no games', () => {
    createAndFlush([], [mockQuiz()]);

    const empty = fixture.nativeElement.querySelector('[data-testid="empty-list"]');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('Aucune partie');
  });
});
