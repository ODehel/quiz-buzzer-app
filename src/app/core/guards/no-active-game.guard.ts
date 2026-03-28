import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { GameStateService } from '../services/game-state.service';

export const noActiveGameGuard: CanActivateFn = () => {
  const gs = inject(GameStateService);
  if (!gs.isPiloting()) return true;

  // CA-29: toast informatif via navigation state
  inject(Router).navigate(['/pilot/play'], {
    state: { toast: 'Vous ne pouvez pas accéder au contenu pendant une partie' },
  });
  return false;
};
