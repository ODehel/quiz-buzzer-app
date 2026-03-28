import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { GameStateService } from '../services/game-state.service';

export const activeGameGuard: CanActivateFn = () => {
  const gs = inject(GameStateService);
  return gs.isPiloting() ? true : inject(Router).createUrlTree(['/dashboard']);
};
