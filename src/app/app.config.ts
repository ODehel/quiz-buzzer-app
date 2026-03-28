import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { WebSocketService } from './core/services/websocket.service';
import { GameStateService } from './core/services/game-state.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      useFactory:
        (auth: AuthService, ws: WebSocketService, gs: GameStateService) =>
        async () => {
          await auth.initialize();
          if (auth.isReady()) {
            ws.connect();
            await gs.syncInitial();
          }
        },
      deps: [AuthService, WebSocketService, GameStateService],
      multi: true,
    },
  ],
};
