import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { noActiveGameGuard } from './no-active-game.guard';
import { GameStateService } from '../services/game-state.service';

describe('noActiveGameGuard', () => {
  let gameStateMock: { isPiloting: jest.Mock };
  let routerMock: { navigate: jest.Mock };

  beforeEach(() => {
    gameStateMock = { isPiloting: jest.fn() };
    routerMock = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: GameStateService, useValue: gameStateMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('CA-19 — returns true when no game is active (isPiloting false)', () => {
    gameStateMock.isPiloting.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      noActiveGameGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
  });

  it('CA-18 — redirects to /pilot/play when a game is active', () => {
    gameStateMock.isPiloting.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      noActiveGameGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/pilot/play']);
  });
});
