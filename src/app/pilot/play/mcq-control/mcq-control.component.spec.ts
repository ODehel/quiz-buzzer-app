import { TestBed } from '@angular/core/testing';

import { McqControlComponent } from './mcq-control.component';
import { GameStateService } from '../../../core/services/game-state.service';

describe('McqControlComponent', () => {
  let gsMock: any;

  function createComponent(statusOverride: string = 'QUESTION_TITLE', stateOverrides: Record<string, any> = {}) {
    const defaultState = {
      gameId: 'game-1',
      status: statusOverride,
      questionIndex: 0,
      questionType: 'MCQ',
      questionTitle: 'Quelle est la capitale de la France ?',
      choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
      timeLimit: 30,
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
        McqControlComponent,
        { provide: GameStateService, useValue: gsMock },
      ],
    });

    return TestBed.inject(McqControlComponent);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // CA-9/CA-10: triggerChoices emits and sets isWaiting
  it('CA-9 — onTriggerChoices emits triggerChoices', () => {
    const component = createComponent('QUESTION_TITLE');
    const spy = jest.fn();
    component.triggerChoices.subscribe(spy);

    component['onTriggerChoices']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-10 — onTriggerChoices sets isWaitingChoices to true', () => {
    const component = createComponent('QUESTION_TITLE');

    component['onTriggerChoices']();

    expect(component['isWaitingChoices']()).toBe(true);
  });

  // CA-16: triggerCorrection emits and disables button
  it('CA-16 — onTriggerCorrection emits triggerCorrection', () => {
    const component = createComponent('QUESTION_OPEN');
    const spy = jest.fn();
    component.triggerCorrection.subscribe(spy);

    component['onTriggerCorrection']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-16 — onTriggerCorrection sets isWaitingCorrection to true', () => {
    const component = createComponent('QUESTION_OPEN');

    component['onTriggerCorrection']();

    expect(component['isWaitingCorrection']()).toBe(true);
  });

  // CA-21: triggerNext emits and disables button
  it('CA-21 — onTriggerNext emits triggerNext', () => {
    const component = createComponent('QUESTION_CLOSED');
    const spy = jest.fn();
    component.triggerNext.subscribe(spy);

    component['onTriggerNext']();

    expect(spy).toHaveBeenCalled();
  });

  it('CA-21 — onTriggerNext sets isWaitingNext to true', () => {
    const component = createComponent('QUESTION_CLOSED');

    component['onTriggerNext']();

    expect(component['isWaitingNext']()).toBe(true);
  });

  // Timer
  it('startTimer sets remainingSeconds based on startedAt and timeLimit', () => {
    const component = createComponent('QUESTION_OPEN');
    const now = Date.now();
    const startedAt = new Date(now - 5000).toISOString(); // 5 seconds ago

    component.startTimer(startedAt, 30);

    expect(component['remainingSeconds']()).toBe(25);
    component.stopTimer();
  });

  it('onTimerTick updates remainingSeconds', () => {
    const component = createComponent('QUESTION_OPEN');

    component.onTimerTick(20);

    expect(component['remainingSeconds']()).toBe(20);
  });

  it('stopTimer clears interval', () => {
    const component = createComponent('QUESTION_OPEN');
    const now = Date.now();
    component.startTimer(new Date(now).toISOString(), 30);

    component.stopTimer();

    // No error, interval cleared
    expect(component['remainingSeconds']()).toBe(30);
  });

  // resetWaiting
  it('resetWaiting clears all waiting flags', () => {
    const component = createComponent('QUESTION_TITLE');
    component['onTriggerChoices']();
    expect(component['isWaitingChoices']()).toBe(true);

    component.resetWaiting();

    expect(component['isWaitingChoices']()).toBe(false);
    expect(component['isWaitingCorrection']()).toBe(false);
    expect(component['isWaitingNext']()).toBe(false);
  });

  // CA-18: lastCorrectAnswer from questionResults
  it('CA-18 — lastCorrectAnswer returns correct answer from last result', () => {
    const component = createComponent('QUESTION_CLOSED', {
      questionResults: [
        {
          question_index: 0,
          question_type: 'MCQ',
          correct_answer: 'Paris',
          results: [],
          ranking: [],
        },
      ],
    });

    expect(component['lastCorrectAnswer']()).toBe('Paris');
  });

  it('lastCorrectAnswer returns null when no results', () => {
    const component = createComponent('QUESTION_TITLE');

    expect(component['lastCorrectAnswer']()).toBeNull();
  });
});
