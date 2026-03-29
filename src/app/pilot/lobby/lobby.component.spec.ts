import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Subject } from 'rxjs';

import { LobbyComponent } from './lobby.component';
import { GameStateService } from '../../core/services/game-state.service';
import { WebSocketService } from '../../core/services/websocket.service';
import type {
  InboundMessage,
  GameStateSyncMessage,
} from '../../core/models/websocket.models';

@Component({ standalone: true, template: '' })
class DummyComponent {}

function buildGameStateSync(
  overrides: Partial<GameStateSyncMessage> = {}
): GameStateSyncMessage {
  return {
    type: 'game_state_sync',
    game_id: 'game-1',
    status: 'PENDING',
    quiz_id: 'quiz-1',
    question_index: null,
    question_type: null,
    question_title: null,
    choices: null,
    participants: [
      { order: 1, name: 'Alice', cumulative_score: 0 },
      { order: 2, name: 'Bob', cumulative_score: 0 },
      { order: 3, name: 'Charlie', cumulative_score: 0 },
    ],
    connected_buzzers: [],
    started_at: null,
    time_limit: null,
    ...overrides,
  };
}

describe('LobbyComponent', () => {
  let fixture: ComponentFixture<LobbyComponent>;
  let component: LobbyComponent;
  let httpMock: HttpTestingController;
  let router: Router;
  let gs: GameStateService;
  let messagesSubject: Subject<InboundMessage>;

  beforeEach(() => {
    messagesSubject = new Subject<InboundMessage>();

    TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'dashboard', component: DummyComponent },
          { path: 'pilot/lobby', component: DummyComponent },
          { path: 'pilot/play', component: DummyComponent },
          { path: 'games', component: DummyComponent },
        ]),
        {
          provide: WebSocketService,
          useValue: {
            messages$: messagesSubject.asObservable(),
            send: jest.fn(),
            isConnected: jest.fn().mockReturnValue(true),
            isReconnecting: jest.fn().mockReturnValue(false),
          },
        },
      ],
    });

    gs = TestBed.inject(GameStateService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(gs, 'startPolling').mockImplementation(() => {});
    jest.spyOn(gs, 'stopPolling').mockImplementation(() => {});
  });

  afterEach(() => {
    httpMock.verify();
  });

  function initPendingGame(
    buzzers: string[] = []
  ): void {
    gs.dispatch(
      buildGameStateSync({ connected_buzzers: buzzers })
    );
  }

  function createComponent(buzzers: string[] = []): void {
    initPendingGame(buzzers);
    fixture = TestBed.createComponent(LobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Flush quiz name request
    const quizReq = httpMock.expectOne('/api/v1/quizzes/quiz-1');
    quizReq.flush({
      id: 'quiz-1',
      name: 'Mon Super Quiz',
      question_ids: ['q1', 'q2'],
      created_at: '2026-03-28T10:00:00Z',
      last_updated_at: null,
    });
    fixture.detectChanges();
  }

  // ── CA-1: Guard redirects to /dashboard if no active game ──
  // Covered by active-game.guard.spec.ts (guard-level test)

  // ── CA-2: Redirect to /pilot/play if status is OPEN ──
  it('CA-2 — redirects to /pilot/play if status is OPEN at mount', () => {
    gs.dispatch(buildGameStateSync({ status: 'OPEN' }));

    fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });

  it('CA-2 — redirects to /pilot/play if status is QUESTION_OPEN at mount', () => {
    gs.dispatch(buildGameStateSync({ status: 'QUESTION_OPEN' }));

    fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });

  // ── CA-3: PENDING status shows lobby normally ──
  it('CA-3 — displays lobby when status is PENDING', () => {
    createComponent();

    const header = fixture.nativeElement.querySelector('[data-testid="lobby-header"]');
    expect(header).toBeTruthy();
  });

  // ── CA-4: Quiz name is displayed ──
  it('CA-4 — displays quiz name from QuizService.getById()', () => {
    createComponent();

    const quizName = fixture.nativeElement.querySelector('[data-testid="quiz-name"]');
    expect(quizName.textContent).toContain('Mon Super Quiz');
  });

  // ── CA-5: Participant count is displayed ──
  it('CA-5 — displays participant count', () => {
    createComponent();

    const count = fixture.nativeElement.querySelector('[data-testid="participant-count"]');
    expect(count.textContent).toContain('3 participants');
  });

  // ── CA-6: Readiness bar color ──
  it('CA-6 — readiness bar is orange when buzzers < participants', () => {
    createComponent(['buzzer-1']);

    const bar = fixture.nativeElement.querySelector('[data-testid="readiness-bar"]');
    expect(bar.classList.contains('insufficient')).toBe(true);
    expect(bar.classList.contains('ready')).toBe(false);
  });

  it('CA-6 — readiness bar is green when buzzers >= participants', () => {
    createComponent(['b1', 'b2', 'b3']);

    const bar = fixture.nativeElement.querySelector('[data-testid="readiness-bar"]');
    expect(bar.classList.contains('ready')).toBe(true);
    expect(bar.classList.contains('insufficient')).toBe(false);
  });

  // ── CA-7: Readiness label ──
  it('CA-7 — readiness label shows buzzer count and participant count', () => {
    createComponent(['buzzer-1']);

    const label = fixture.nativeElement.querySelector('[data-testid="readiness-label"]');
    expect(label.textContent).toContain('1 / 3 buzzers connectes');
  });

  // ── CA-8: Real-time update (simulated via signal change) ──
  it('CA-8 — readiness bar updates when connectedBuzzers changes', () => {
    createComponent([]);

    let bar = fixture.nativeElement.querySelector('[data-testid="readiness-bar"]');
    expect(bar.classList.contains('insufficient')).toBe(true);

    // Simulate buzzer connections via WebSocket
    messagesSubject.next(
      buildGameStateSync({ connected_buzzers: ['b1', 'b2', 'b3'] })
    );
    fixture.detectChanges();

    bar = fixture.nativeElement.querySelector('[data-testid="readiness-bar"]');
    expect(bar.classList.contains('ready')).toBe(true);
  });

  // ── CA-9: Participants with buzzer association ──
  it('CA-9 — displays participants with order, name, and buzzer indicator', () => {
    createComponent(['buzzer-1']);

    const items = fixture.nativeElement.querySelectorAll('[data-testid="participant-item"]');
    expect(items.length).toBe(3);

    const firstItem = items[0];
    expect(firstItem.textContent).toContain('1');
    expect(firstItem.textContent).toContain('Alice');
    expect(firstItem.textContent).toContain('buzzer-1');
  });

  // ── CA-10: Participants without buzzer show "Non connecté" ──
  it('CA-10 — participants without buzzer show "Non connecté"', () => {
    createComponent(['buzzer-1']);

    const statuses = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-status"]');
    expect(statuses[0].textContent.trim()).toBe('buzzer-1');
    expect(statuses[1].textContent.trim()).toBe('Non connecte');
    expect(statuses[2].textContent.trim()).toBe('Non connecte');

    expect(statuses[1].classList.contains('offline')).toBe(true);
  });

  // ── CA-11: Buzzer list with usernames ──
  it('CA-11 — displays connected buzzers with their usernames', () => {
    createComponent(['buzzer-1', 'buzzer-2']);

    const slots = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-slot"]');
    const usernames = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-username"]');
    expect(usernames[0].textContent.trim()).toBe('buzzer-1');
    expect(usernames[1].textContent.trim()).toBe('buzzer-2');
  });

  // ── CA-12: 10 buzzer slots, disconnected ones grayed ──
  it('CA-12 — shows 10 buzzer slots with inactive class for empty slots', () => {
    createComponent(['buzzer-1']);

    const slots = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-slot"]');
    expect(slots.length).toBe(10);

    const avatar0 = slots[0].querySelector('.buzzer-avatar');
    const avatar1 = slots[1].querySelector('.buzzer-avatar');
    expect(avatar0.classList.contains('online')).toBe(true);
    expect(avatar1.classList.contains('offline')).toBe(true);
  });

  // ── CA-13: Buzzer list updates in real-time ──
  it('CA-13 — buzzer list updates in real-time via GameStateService', () => {
    createComponent([]);

    let slots = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-slot"]');
    let avatar0 = slots[0].querySelector('.buzzer-avatar');
    expect(avatar0.classList.contains('offline')).toBe(true);

    messagesSubject.next(
      buildGameStateSync({ connected_buzzers: ['new-buzzer'] })
    );
    fixture.detectChanges();

    slots = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-slot"]');
    const usernames = fixture.nativeElement.querySelectorAll('[data-testid="buzzer-username"]');
    expect(usernames[0].textContent.trim()).toBe('new-buzzer');
    avatar0 = slots[0].querySelector('.buzzer-avatar');
    expect(avatar0.classList.contains('online')).toBe(true);
  });

  // ── CA-14: Start button always visible and clickable ──
  it('CA-14 — start button is always visible regardless of readiness', () => {
    createComponent([]);

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-start"]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  // ── CA-15: Start calls POST /api/v1/games/:id/start ──
  it('CA-15 — clicking start calls gameService.start()', async () => {
    createComponent();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-start"]');
    btn.click();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/v1/games/game-1/start');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'game-1',
      quiz_id: 'quiz-1',
      status: 'OPEN',
      participants: [],
      created_at: '2026-03-28T10:00:00Z',
      started_at: '2026-03-28T10:05:00Z',
      completed_at: null,
    });
    await fixture.whenStable();
  });

  // ── CA-16/CA-17: Navigation triggered by game_state_sync OPEN, not by REST ──
  it('CA-16/CA-17 — navigates to /pilot/play when game_state_sync with OPEN is received', () => {
    createComponent();

    // Simulate WebSocket status change
    messagesSubject.next(buildGameStateSync({ status: 'OPEN' }));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });

  // ── CA-18: Error toast on start failure ──
  it('CA-18 — shows error toast when start fails', async () => {
    createComponent();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-start"]');
    btn.click();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/v1/games/game-1/start');
    req.flush(
      { error: 'INTERNAL_ERROR' },
      { status: 500, statusText: 'Internal Server Error' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Impossible de démarrer la partie');
    expect(component.isStarting()).toBe(false);
  });

  // ── CA-19: Delete button is visible ──
  it('CA-19 — delete button is visible in the lobby', () => {
    createComponent();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Annuler la partie');
  });

  // ── CA-20: Delete opens confirm dialog ──
  it('CA-20 — clicking delete opens confirm dialog', async () => {
    createComponent();

    const confirmSpy = jest.spyOn(component.confirmDialog, 'open').mockResolvedValue(false);

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    btn.click();
    await fixture.whenStable();

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer la partie en attente ?');
  });

  // ── CA-21: After confirmation, DELETE is called, reset, navigate ──
  it('CA-21 — after confirm, deletes game, resets state, navigates to /games', async () => {
    createComponent();

    jest.spyOn(component.confirmDialog, 'open').mockResolvedValue(true);
    jest.spyOn(gs, 'reset');

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    btn.click();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/v1/games/game-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(gs.reset).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/games']);
  });

  // ── CA-22: Error toast on delete failure ──
  it('CA-22 — shows error toast when delete fails', async () => {
    createComponent();

    jest.spyOn(component.confirmDialog, 'open').mockResolvedValue(true);

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    btn.click();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/v1/games/game-1');
    req.flush(
      { error: 'INTERNAL_ERROR' },
      { status: 500, statusText: 'Internal Server Error' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[data-testid="toast"]');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Erreur lors de la suppression');
    expect(component.isDeleting()).toBe(false);
  });

  // ── CA-23: Reconnection in PENDING keeps lobby ──
  it('CA-23 — game_state_sync with PENDING keeps lobby displayed', () => {
    createComponent(['b1']);

    messagesSubject.next(
      buildGameStateSync({
        status: 'PENDING',
        connected_buzzers: ['b1', 'b2'],
        participants: [
          { order: 1, name: 'Alice', cumulative_score: 0 },
          { order: 2, name: 'Bob', cumulative_score: 0 },
          { order: 3, name: 'Charlie', cumulative_score: 0 },
        ],
      })
    );
    fixture.detectChanges();

    // Lobby is still displayed
    const header = fixture.nativeElement.querySelector('[data-testid="lobby-header"]');
    expect(header).toBeTruthy();

    // Buzzers updated
    const label = fixture.nativeElement.querySelector('[data-testid="readiness-label"]');
    expect(label.textContent).toContain('2 / 3 buzzers connectes');
  });

  // ── CA-24: game_state_sync with OPEN triggers navigation ──
  it('CA-24 — game_state_sync with OPEN during lobby navigates to /pilot/play', () => {
    createComponent();

    messagesSubject.next(buildGameStateSync({ status: 'OPEN' }));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });

  // ── Delete cancelled does not call API ──
  it('does not call API when delete is cancelled', async () => {
    createComponent();

    jest.spyOn(component.confirmDialog, 'open').mockResolvedValue(false);

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-delete"]');
    btn.click();
    await fixture.whenStable();

    httpMock.expectNone('/api/v1/games/game-1');
  });

  // ── Start button disabled while starting ──
  it('disables start button while starting', async () => {
    createComponent();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-start"]');
    btn.click();
    fixture.detectChanges();

    expect(component.isStarting()).toBe(true);
    expect(btn.disabled).toBe(true);

    const req = httpMock.expectOne('/api/v1/games/game-1/start');
    req.flush({
      id: 'game-1',
      status: 'OPEN',
      quiz_id: 'quiz-1',
      participants: [],
      created_at: '2026-03-28T10:00:00Z',
      started_at: '2026-03-28T10:05:00Z',
      completed_at: null,
    });
    await fixture.whenStable();
  });
});
