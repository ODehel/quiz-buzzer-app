import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { activeGameGuard } from './core/guards/active-game.guard';
import { noActiveGameGuard } from './core/guards/no-active-game.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'content',
    canActivate: [authGuard, noActiveGameGuard],
    children: [
      { path: '', redirectTo: 'questions', pathMatch: 'full' },
      {
        path: 'themes',
        loadComponent: () =>
          import('./content/content-shell.component').then(
            (m) => m.ContentShellComponent
          ),
      },
      {
        path: 'questions',
        loadComponent: () =>
          import('./content/questions/question-list.component').then(
            (m) => m.QuestionListComponent
          ),
      },
      {
        path: 'questions/new',
        loadComponent: () =>
          import('./content/questions/question-form.component').then(
            (m) => m.QuestionFormComponent
          ),
      },
      {
        path: 'questions/:id',
        loadComponent: () =>
          import('./content/questions/question-form.component').then(
            (m) => m.QuestionFormComponent
          ),
      },
    ],
  },
  {
    path: 'games',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./games/game-list.component').then(
            (m) => m.GameListComponent
          ),
      },
    ],
  },
  {
    path: 'pilot',
    canActivate: [authGuard, activeGameGuard],
    children: [
      { path: '', redirectTo: 'lobby', pathMatch: 'full' },
      {
        path: 'lobby',
        loadComponent: () =>
          import('./pilot/pilot-shell.component').then(
            (m) => m.PilotShellComponent
          ),
      },
      {
        path: 'play',
        loadComponent: () =>
          import('./pilot/pilot-shell.component').then(
            (m) => m.PilotShellComponent
          ),
      },
    ],
  },
  {
    path: 'error',
    loadComponent: () =>
      import('./error/error.component').then((m) => m.ErrorComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
