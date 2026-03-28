import { TestBed } from '@angular/core/testing';

import { PlayerListComponent } from './player-list.component';
import { GameStateService } from '../../../core/services/game-state.service';

describe('PlayerListComponent', () => {
  function createComponent(stateOverrides: Record<string, any> = {}) {
    const defaultState = {
      gameId: 'game-1',
      status: 'QUESTION_OPEN',
      questionType: 'MCQ',
      participants: [
        { order: 1, name: 'Alice', cumulative_score: 10 },
        { order: 2, name: 'Bob', cumulative_score: 5 },
      ],
      playerAnswers: [],
      currentBuzzer: null,
      invalidatedPlayers: [],
      ...stateOverrides,
    };

    const gsMock = {
      state: jest.fn().mockReturnValue(defaultState),
      status: jest.fn().mockReturnValue(defaultState.status),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerListComponent,
        { provide: GameStateService, useValue: gsMock },
      ],
    });

    return TestBed.inject(PlayerListComponent);
  }

  // CA-12: players computed from participants
  it('CA-12 — players returns participants with answer info', () => {
    const component = createComponent({
      playerAnswers: [
        { participant_name: 'Alice', participant_order: 1, choice: 'A', response_time_ms: 2500 },
      ],
    });

    const players = component['players']();

    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('Alice');
    expect(players[0].answer).toEqual({
      participant_name: 'Alice',
      participant_order: 1,
      choice: 'A',
      response_time_ms: 2500,
    });
    expect(players[1].answer).toBeNull();
  });

  // CA-27: buzzer marked
  it('CA-27 — marks player as buzzer when currentBuzzer matches', () => {
    const component = createComponent({
      currentBuzzer: 'Alice',
    });

    const players = component['players']();

    expect(players[0].isBuzzer).toBe(true);
    expect(players[1].isBuzzer).toBe(false);
  });

  // CA-27: invalidated players
  it('CA-27 — marks player as invalidated', () => {
    const component = createComponent({
      invalidatedPlayers: ['Bob'],
    });

    const players = component['players']();

    expect(players[0].isInvalidated).toBe(false);
    expect(players[1].isInvalidated).toBe(true);
  });

  it('displays cumulative scores', () => {
    const component = createComponent();

    const players = component['players']();

    expect(players[0].cumulative_score).toBe(10);
    expect(players[1].cumulative_score).toBe(5);
  });
});
