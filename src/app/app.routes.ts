import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { LobbyComponent } from './components/lobby/lobby';
import { QuestionsComponent } from './components/questions/questions';
import { GameConfigComponent } from './components/game-config/game-config';
import { GamePlayComponent } from './components/game-play/game-play';
import { ResultsComponent } from './components/results/results';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'lobby', component: LobbyComponent },
  { path: 'questions', component: QuestionsComponent },
  { path: 'game-config', component: GameConfigComponent },
  { path: 'game/:id', component: GamePlayComponent },
  { path: 'results/:id', component: ResultsComponent },
  { path: '**', redirectTo: '' }
];