import { TestBed } from '@angular/core/testing';

import { SpeedControlComponent } from './speed-control.component';
import { GameStateService } from '../../../core/services/game-state.service';

describe('SpeedControlComponent', () => {
  let gsMock: any;

  function createComponent(statusOverride: string = 'QUESTION_OPEN', stateOverrides: Record<string, any> = {}) {
    const defaultState = {
      gameId: 'game-1',
      status: statusOverride,
      questionIndex: 0,
      questionType: 'SPEED',
      questionTitle: 'Qui a peint la Joconde ?',
      choices: null,
      timeLimit: 15,
      totalQuestions: 10,
      startedAt: null,
      remainingSeconds: null,
      timerEnded: false,
      playerAnswers: [],
      allAnswered: false,
      currentBuzzer: null,
      ranking: null,
      questionResults: [],
      participants: [],
      connectedBuzzers: [],
      invalidatedPlayers: [],
      ...stateOverrides,
    };

    gsMock = {
      state: jest.fn().mockReturnValue(defaultState),
      status: jest.fn().mockReturnValue(statusOverride),
      canCorrect: jest.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      providers: [
        SpeedControlComponent,
        { provide: GameStateService, useValue: gsMock },
      ],
    });

    return TestBed.inject(SpeedControlComponent);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // CA-24: validate/invalidate disabled in QUESTION_OPEN (tested via template, but we test the signals)
  it('CA-24 — isWaitingValidation starts as false', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(component['isWaitingValidation']()).toBe(false);
  });

  // CA-28: validate_answer emitted and button disabled
  it('CA-28 — onValidateAnswer emits validateAnswer', () => {
    const component = createComponent('QUESTION_BUZZED', { currentBuzzer: 'Alice' });
    const spy = jest.fn();
    component.validateAnswer.subscribe(spy);

    component['onValidateAnswer']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-28 — onValidateAnswer sets isWaitingValidation to true', () => {
    const component = createComponent('QUESTION_BUZZED', { currentBuzzer: 'Alice' });

    component['onValidateAnswer']();

    expect(component['isWaitingValidation']()).toBe(true);
  });

  // CA-29: invalidate_answer emitted and button disabled
  it('CA-29 — onInvalidateAnswer emits invalidateAnswer', () => {
    const component = createComponent('QUESTION_BUZZED', { currentBuzzer: 'Alice' });
    const spy = jest.fn();
    component.invalidateAnswer.subscribe(spy);

    component['onInvalidateAnswer']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-29 — onInvalidateAnswer sets isWaitingValidation to true', () => {
    const component = createComponent('QUESTION_BUZZED', { currentBuzzer: 'Alice' });

    component['onInvalidateAnswer']();

    expect(component['isWaitingValidation']()).toBe(true);
  });

  // CA-34: triggerNext (same as MCQ)
  it('CA-34 — onTriggerNext emits triggerNext', () => {
    const component = createComponent('QUESTION_CLOSED');
    const spy = jest.fn();
    component.triggerNext.subscribe(spy);

    component['onTriggerNext']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-34 — onTriggerNext sets isWaitingNext to true', () => {
    const component = createComponent('QUESTION_CLOSED');

    component['onTriggerNext']();

    expect(component['isWaitingNext']()).toBe(true);
  });

  // Timer methods
  it('startTimer sets remainingSeconds based on startedAt and timeLimit', () => {
    const component = createComponent('QUESTION_OPEN');
    const now = Date.now();
    const startedAt = new Date(now - 3000).toISOString();

    component.startTimer(startedAt, 15);

    expect(component['remainingSeconds']()).toBe(12);
    component.stopTimer();
  });

  it('onTimerTick updates remainingSeconds', () => {
    const component = createComponent('QUESTION_OPEN');

    component.onTimerTick(10);

    expect(component['remainingSeconds']()).toBe(10);
  });

  it('pauseTimer stops the timer', () => {
    const component = createComponent('QUESTION_OPEN');
    const now = Date.now();
    component.startTimer(new Date(now).toISOString(), 15);

    component.pauseTimer();

    // No error thrown
    expect(component['remainingSeconds']()).toBe(15);
  });

  it('resumeTimer restarts with given seconds', () => {
    const component = createComponent('QUESTION_OPEN');

    component.resumeTimer(10);

    expect(component['remainingSeconds']()).toBe(10);
    component.stopTimer();
  });

  // resetWaiting
  it('resetWaiting clears all waiting flags', () => {
    const component = createComponent('QUESTION_BUZZED', { currentBuzzer: 'Alice' });
    component['onValidateAnswer']();
    expect(component['isWaitingValidation']()).toBe(true);

    component.resetWaiting();

    expect(component['isWaitingValidation']()).toBe(false);
    expect(component['isWaitingNext']()).toBe(false);
  });

  // CA-32: speedWinner computed
  it('CA-32 — speedWinner returns winner name', () => {
    const component = createComponent('QUESTION_CLOSED', {
      questionResults: [
        {
          question_index: 0,
          question_type: 'SPEED',
          correct_answer: 'Leonardo da Vinci',
          results: [
            { participant_name: 'Alice', participant_order: 1, winner: true, points_earned: 10 },
            { participant_name: 'Bob', participant_order: 2, winner: false, points_earned: 0 },
          ],
          ranking: [],
        },
      ],
    });

    expect(component['speedWinner']()).toBe('Alice');
  });

  it('CA-32 — speedWinner returns null when no winner', () => {
    const component = createComponent('QUESTION_CLOSED', {
      questionResults: [
        {
          question_index: 0,
          question_type: 'SPEED',
          correct_answer: 'Leonardo da Vinci',
          results: [
            { participant_name: 'Alice', participant_order: 1, winner: false, points_earned: 0 },
            { participant_name: 'Bob', participant_order: 2, winner: false, points_earned: 0 },
          ],
          ranking: [],
        },
      ],
    });

    expect(component['speedWinner']()).toBeNull();
  });

  it('speedWinner returns null when no results', () => {
    const component = createComponent('QUESTION_OPEN');

    expect(component['speedWinner']()).toBeNull();
  });
});
