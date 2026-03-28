import { TestBed } from '@angular/core/testing';

import { RankingComponent } from './ranking.component';
import { GameStateService } from '../../../core/services/game-state.service';

describe('RankingComponent', () => {
  function createComponent() {
    const gsMock = {
      state: jest.fn().mockReturnValue({
        ranking: [
          { rank: 1, participant_name: 'Alice', participant_order: 1, cumulative_score: 20, total_time_ms: 15000 },
          { rank: 2, participant_name: 'Bob', participant_order: 2, cumulative_score: 10, total_time_ms: 25000 },
        ],
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        RankingComponent,
        { provide: GameStateService, useValue: gsMock },
      ],
    });

    return TestBed.inject(RankingComponent);
  }

  // CA-38: ranking data accessible
  it('CA-38 — ranking data is available from GameStateService', () => {
    const component = createComponent();

    expect(component['gs'].state().ranking).toHaveLength(2);
    expect(component['gs'].state().ranking![0].participant_name).toBe('Alice');
  });

  // CA-39: close emits
  it('CA-39 — close event emitter works', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.close.subscribe(spy);

    component.close.emit();

    expect(spy).toHaveBeenCalled();
  });

  // formatTime
  it('formatTime formats milliseconds to seconds', () => {
    const component = createComponent();

    expect(component['formatTime'](5000)).toBe('5s');
  });

  it('formatTime formats milliseconds to minutes and seconds', () => {
    const component = createComponent();

    expect(component['formatTime'](90000)).toBe('1m 30s');
  });

  it('formatTime handles zero', () => {
    const component = createComponent();

    expect(component['formatTime'](0)).toBe('0s');
  });
});
