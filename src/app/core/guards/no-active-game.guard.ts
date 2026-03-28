import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { GameStateService } from '../services/game-state.service';

export const noActiveGameGuard: CanActivateFn = () => {
  const gs = inject(GameStateService);
  if (!gs.isPiloting()) return true;
  inject(Router).navigate(['/pilot/play']);
  return false;
};
