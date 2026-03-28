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
          import('./content/themes/theme-list.component').then(
            (m) => m.ThemeListComponent
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
        path: 'quizzes',
        loadComponent: () =>
          import('./content/quizzes/quiz-list.component').then(
            (m) => m.QuizListComponent
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
      {
        path: 'sounds',
        loadComponent: () =>
          import('./content/sounds/sound-list.component').then(
            (m) => m.SoundListComponent
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
      {
        path: 'new',
        loadComponent: () =>
          import('./games/game-create.component').then(
            (m) => m.GameCreateComponent
          ),
      },
      {
        path: ':id/results',
        loadComponent: () =>
          import('./pilot/results/game-results.component').then(
            (m) => m.GameResultsComponent
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
          import('./pilot/lobby/lobby.component').then(
            (m) => m.LobbyComponent
          ),
      },
      {
        path: 'play',
        loadComponent: () =>
          import('./pilot/play/play.component').then(
            (m) => m.PlayComponent
          ),
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./pilot/results/game-results.component').then(
            (m) => m.GameResultsComponent
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
