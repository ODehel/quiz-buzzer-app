import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { PlayComponent } from './play.component';
import { GameStateService } from '../../core/services/game-state.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { SoundService } from '../../content/sounds/sound.service';
import type { InboundMessage } from '../../core/models/websocket.models';
import { of } from 'rxjs';

describe('PlayComponent', () => {
  let messagesSubject: Subject<InboundMessage>;
  let wsMock: { send: jest.Mock; messages$: Subject<InboundMessage>; isConnected: jest.Mock; isReconnecting: jest.Mock };
  let routerMock: { navigate: jest.Mock };
  let gsMock: any;

  function createComponent(statusOverride: string | null = 'OPEN', stateOverrides: Record<string, any> = {}) {
    messagesSubject = new Subject<InboundMessage>();
    wsMock = {
      send: jest.fn(),
      messages$: messagesSubject,
      isConnected: jest.fn().mockReturnValue(true),
      isReconnecting: jest.fn().mockReturnValue(false),
    };

    routerMock = { navigate: jest.fn() };

    const defaultState = {
      gameId: 'game-1',
      status: statusOverride,
      quizId: 'quiz-1',
      questionIndex: 0,
      questionType: null,
      questionTitle: null,
      choices: null,
      participants: [],
      connectedBuzzers: [],
      startedAt: null,
      timeLimit: null,
      totalQuestions: 5,
      remainingSeconds: null,
      timerEnded: false,
      playerAnswers: [],
      allAnswered: false,
      currentBuzzer: null,
      ranking: null,
      questionResults: [],
      invalidatedPlayers: [],
      ...stateOverrides,
    };

    gsMock = {
      state: jest.fn().mockReturnValue(defaultState),
      status: jest.fn().mockReturnValue(statusOverride),
      isActive: jest.fn().mockReturnValue(true),
      isPiloting: jest.fn().mockReturnValue(true),
      connectedBuzzers: jest.fn().mockReturnValue([]),
      canCorrect: jest.fn().mockReturnValue(false),
      dismissRanking: jest.fn(),
      buildResults: jest.fn().mockReturnValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayComponent,
        { provide: WebSocketService, useValue: wsMock },
        { provide: GameStateService, useValue: gsMock },
        { provide: Router, useValue: routerMock },
        { provide: SoundService, useValue: { getAll: jest.fn().mockReturnValue(of({ data: [] })) } },
      ],
    });

    return TestBed.inject(PlayComponent);
  }

  // CA-5: Button "Déclencher la question" sends trigger_title
  it('CA-5 — onTriggerTitle sends trigger_title via ws.send', () => {
    const component = createComponent('OPEN');

    component['onTriggerTitle']();

    expect(wsMock.send).toHaveBeenCalledWith({ type: 'trigger_title' });
  });

  it('CA-5 — onTriggerTitle sets isWaitingTrigger to true', () => {
    const component = createComponent('OPEN');

    component['onTriggerTitle']();

    expect(component['isWaitingTrigger']()).toBe(true);
  });

  // CA-5: isWaitingTrigger resets on question_title
  it('CA-5 — isWaitingTrigger resets when question_title received', () => {
    const component = createComponent('OPEN');
    component['onTriggerTitle']();

    messagesSubject.next({
      type: 'question_title',
      question_index: 0,
      question_type: 'MCQ',
      title: 'Test',
      time_limit: 30,
      total_questions: 5,
    } as any);

    expect(component['isWaitingTrigger']()).toBe(false);
  });

  // CA-5: isWaitingTrigger resets on question_open (SPEED)
  it('CA-5 — isWaitingTrigger resets when question_open received', () => {
    const component = createComponent('OPEN');
    component['onTriggerTitle']();

    messagesSubject.next({
      type: 'question_open',
      question_index: 0,
      question_type: 'SPEED',
      title: 'Test',
      time_limit: 15,
      total_questions: 5,
      started_at: '2026-03-28T10:00:00.000Z',
    } as any);

    expect(component['isWaitingTrigger']()).toBe(false);
  });

  // CA-17: ANSWERS_PENDING error shows toast
  it('CA-17 — shows toast on ANSWERS_PENDING error', () => {
    const component = createComponent('QUESTION_OPEN');

    messagesSubject.next({ type: 'error', code: 'ANSWERS_PENDING' } as any);

    expect(component['toastMessage']()).toBe('Des joueurs n\'ont pas encore répondu');
  });

  // CA-40: INVALID_STATE error shows toast
  it('CA-40 — shows toast on INVALID_STATE error', () => {
    const component = createComponent('QUESTION_OPEN');

    messagesSubject.next({ type: 'error', code: 'INVALID_STATE' } as any);

    expect(component['toastMessage']()).toBe('Classement indisponible dans cet état');
  });

  // handleMessage — question_choices (no ViewChild in unit test, but path still executes)
  it('handles question_choices without mcqControl', () => {
    const component = createComponent('QUESTION_TITLE');

    expect(() => {
      messagesSubject.next({
        type: 'question_choices',
        choices: ['A', 'B', 'C', 'D'],
        started_at: '2026-03-28T10:00:00.000Z',
      } as any);
    }).not.toThrow();
  });

  // handleMessage — timer_tick
  it('handles timer_tick without controls', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(() => {
      messagesSubject.next({
        type: 'timer_tick',
        remaining_seconds: 25,
      } as any);
    }).not.toThrow();
  });

  // handleMessage — timer_end
  it('handles timer_end without controls', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(() => {
      messagesSubject.next({ type: 'timer_end' } as any);
    }).not.toThrow();
  });

  // handleMessage — buzz_locked
  it('handles buzz_locked without speedControl', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(() => {
      messagesSubject.next({
        type: 'buzz_locked',
        participant_name: 'Alice',
        participant_order: 1,
      } as any);
    }).not.toThrow();
  });

  // handleMessage — buzz_unlocked
  it('handles buzz_unlocked without speedControl', () => {
    const component = createComponent('QUESTION_BUZZED');

    expect(() => {
      messagesSubject.next({
        type: 'buzz_unlocked',
        remaining_seconds: 12,
        invalidated_participant: 'Alice',
      } as any);
    }).not.toThrow();
  });

  // handleMessage — question_result_summary
  it('handles question_result_summary without controls', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(() => {
      messagesSubject.next({
        type: 'question_result_summary',
        question_index: 0,
        question_type: 'MCQ',
        correct_answer: 'Paris',
        results: [],
        ranking: [],
      } as any);
    }).not.toThrow();
  });

  // toast auto-clears
  it('toast clears after timeout', () => {
    jest.useFakeTimers();
    const component = createComponent('QUESTION_OPEN');

    messagesSubject.next({ type: 'error', code: 'ANSWERS_PENDING' } as any);
    expect(component['toastMessage']()).not.toBeNull();

    jest.advanceTimersByTime(4000);
    expect(component['toastMessage']()).toBeNull();

    jest.useRealTimers();
  });
});
