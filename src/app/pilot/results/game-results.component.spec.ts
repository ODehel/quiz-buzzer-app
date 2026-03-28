import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { GameResultsComponent } from './game-results.component';
import { GameStateService } from '../../core/services/game-state.service';
import { GameService } from '../../games/game.service';
import type { QuestionResult } from '../../core/services/game-state.service';
import type { RankingEntry, McqPlayerResult, SpeedPlayerResult } from '../../core/models/websocket.models';

const MOCK_RANKING: RankingEntry[] = [
  { rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 30, total_time_ms: 15000 },
  { rank: 2, participant_name: 'Bob', participant_order: 2, cumulative_score: 20, total_time_ms: 25000 },
  { rank: 3, participant_name: 'Charlie', participant_order: 3, cumulative_score: 10, total_time_ms: 35000 },
];

const MOCK_QUESTION_RESULTS: QuestionResult[] = [
  {
    question_index: 0,
    question_type: 'MCQ',
    correct_answer: 'Paris',
    results: [
      { participant_name: 'Alice', participant_order: 1, choice: 'Paris', correct: true, response_time_ms: 5000, points_earned: 10 } as McqPlayerResult,
      { participant_name: 'Bob', participant_order: 2, choice: 'Lyon', correct: false, response_time_ms: 8000, points_earned: 0 } as McqPlayerResult,
      { participant_name: 'Charlie', participant_order: 3, choice: null, correct: false, response_time_ms: null, points_earned: 0 } as McqPlayerResult,
    ],
    ranking: MOCK_RANKING,
  },
  {
    question_index: 1,
    question_type: 'SPEED',
    correct_answer: 'Leonardo da Vinci',
    results: [
      { participant_name: 'Alice', participant_order: 1, winner: true, points_earned: 20 } as SpeedPlayerResult,
      { participant_name: 'Bob', participant_order: 2, winner: false, points_earned: 0 } as SpeedPlayerResult,
    ],
    ranking: MOCK_RANKING,
  },
];

describe('GameResultsComponent', () => {
  function createComponent(routeId: string | null = null, questionResults: QuestionResult[] = MOCK_QUESTION_RESULTS) {
    const gsMock = {
      state: jest.fn().mockReturnValue({
        gameId: 'game-1',
        participants: [
          { order: 1, name: 'Alice', cumulative_score: 30 },
          { order: 2, name: 'Bob', cumulative_score: 20 },
          { order: 3, name: 'Charlie', cumulative_score: 10 },
        ],
      }),
      isActive: jest.fn().mockReturnValue(false),
      buildResults: jest.fn().mockReturnValue(questionResults),
    };

    const gameServiceMock = {
      getResults: jest.fn().mockReturnValue(of({
        game_id: 'game-1',
        quiz_name: 'Test Quiz',
        started_at: '2026-03-28T10:00:00.000Z',
        completed_at: '2026-03-28T10:30:00.000Z',
        rankings: MOCK_RANKING,
      })),
    };

    const routeMock = {
      snapshot: {
        paramMap: {
          get: jest.fn().mockReturnValue(routeId),
        },
      },
    };

    TestBed.configureTestingModule({
      providers: [
        GameResultsComponent,
        { provide: GameStateService, useValue: gsMock },
        { provide: GameService, useValue: gameServiceMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });

    return { component: TestBed.inject(GameResultsComponent), gameServiceMock, gsMock };
  }

  // CA-42: Live results from GameStateService
  it('CA-42 — loads live results from GameStateService when no route id', () => {
    const { component } = createComponent(null);

    expect(component['results']()).not.toBeNull();
    expect(component['results']()!.rankings).toEqual(MOCK_RANKING);
    expect(component['results']()!.questionResults).toHaveLength(2);
    expect(component['isLoading']()).toBe(false);
  });

  // CA-43: Historical results from REST
  it('CA-43 — loads historical results from REST when route id is present', () => {
    const { component, gameServiceMock } = createComponent('game-history');

    expect(gameServiceMock.getResults).toHaveBeenCalledWith('game-history');
    expect(component['results']()).not.toBeNull();
    expect(component['isLoading']()).toBe(false);
  });

  // CA-44: Podium shows top 3
  it('CA-44 — podium returns top 3 entries', () => {
    const { component } = createComponent(null);

    const podium = component['podium']();

    expect(podium).toHaveLength(3);
    expect(podium[0].participant_name).toBe('Alice');
    expect(podium[1].participant_name).toBe('Bob');
    expect(podium[2].participant_name).toBe('Charlie');
  });

  // CA-45: getCellStatus for MCQ
  it('CA-45 — getCellStatus returns correct for MCQ correct answer', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[0];

    expect(component['getCellStatus'](qr, 'Alice')).toBe('correct');
  });

  it('CA-45 — getCellStatus returns wrong for MCQ incorrect answer', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[0];

    expect(component['getCellStatus'](qr, 'Bob')).toBe('wrong');
  });

  it('CA-45 — getCellStatus returns absent for MCQ null choice', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[0];

    expect(component['getCellStatus'](qr, 'Charlie')).toBe('absent');
  });

  // CA-45: getCellStatus for SPEED
  it('CA-45 — getCellStatus returns correct for SPEED winner', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[1];

    expect(component['getCellStatus'](qr, 'Alice')).toBe('correct');
  });

  it('CA-45 — getCellStatus returns wrong for SPEED non-winner', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[1];

    expect(component['getCellStatus'](qr, 'Bob')).toBe('wrong');
  });

  // CA-46: SPEED with no answers shows absent
  it('CA-46 — getCellStatus returns absent for SPEED with empty results', () => {
    const { component } = createComponent(null);
    const qr: QuestionResult = {
      question_index: 2,
      question_type: 'SPEED',
      correct_answer: 'Test',
      results: [],
      ranking: [],
    };

    expect(component['getCellStatus'](qr, 'Alice')).toBe('absent');
  });

  it('CA-46 — getCellLabel returns dash for SPEED with empty results', () => {
    const { component } = createComponent(null);
    const qr: QuestionResult = {
      question_index: 2,
      question_type: 'SPEED',
      correct_answer: 'Test',
      results: [],
      ranking: [],
    };

    expect(component['getCellLabel'](qr, 'Alice')).toBe('—');
  });

  // CA-47: New game button navigates
  it('CA-47 — onNewGame navigates to /games/new', () => {
    const { component } = createComponent(null);
    const router = TestBed.inject(Router);

    component['onNewGame']();

    expect(router.navigate).toHaveBeenCalledWith(['/games/new']);
  });

  // formatTime
  it('formatTime formats correctly', () => {
    const { component } = createComponent(null);

    expect(component['formatTime'](15000)).toBe('15s');
    expect(component['formatTime'](90000)).toBe('1m 30s');
  });

  // getCellLabel
  it('getCellLabel returns choice and points for MCQ', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[0];

    expect(component['getCellLabel'](qr, 'Alice')).toBe('Paris (10pts)');
  });

  it('getCellLabel returns dash for MCQ absent', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[0];

    expect(component['getCellLabel'](qr, 'Charlie')).toBe('—');
  });

  it('getCellLabel returns check and points for SPEED winner', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[1];

    expect(component['getCellLabel'](qr, 'Alice')).toBe('✓ (20pts)');
  });

  it('getCellLabel returns X for SPEED non-winner', () => {
    const { component } = createComponent(null);
    const qr = MOCK_QUESTION_RESULTS[1];

    expect(component['getCellLabel'](qr, 'Bob')).toBe('✗');
  });

  // Fallback to REST when no live results
  it('falls back to REST when no live questionResults and gameId exists', () => {
    const { gameServiceMock } = createComponent(null, []);

    expect(gameServiceMock.getResults).toHaveBeenCalledWith('game-1');
  });
});
