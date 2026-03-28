import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { activeGameGuard } from './active-game.guard';
import { GameStateService } from '../services/game-state.service';

describe('activeGameGuard', () => {
  let gameStateMock: { isPiloting: jest.Mock };
  let routerMock: { createUrlTree: jest.Mock };

  beforeEach(() => {
    gameStateMock = { isPiloting: jest.fn() };
    routerMock = {
      createUrlTree: jest.fn().mockReturnValue('/dashboard' as any),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: GameStateService, useValue: gameStateMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('CA-18 — returns true when a game is active (isPiloting true)', () => {
    gameStateMock.isPiloting.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      activeGameGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
  });

  it('CA-19 — redirects to /dashboard when no game is active', () => {
    gameStateMock.isPiloting.mockReturnValue(false);

    TestBed.runInInjectionContext(() =>
      activeGameGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });
});
