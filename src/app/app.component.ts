import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { GameStateService } from './core/services/game-state.service';
import { WebSocketService } from './core/services/websocket.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside class="sidebar" data-testid="sidebar">
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" data-testid="nav-dashboard">
            Tableau de bord
          </a>

          <div class="sidebar__group-label">Contenu</div>
          @if (gs.isPiloting()) {
            <span class="sidebar__link sidebar__link--disabled" title="Indisponible pendant une partie" data-testid="nav-themes">Thèmes</span>
            <span class="sidebar__link sidebar__link--disabled" title="Indisponible pendant une partie" data-testid="nav-questions">Questions</span>
            <span class="sidebar__link sidebar__link--disabled" title="Indisponible pendant une partie" data-testid="nav-quizzes">Quiz</span>
            <span class="sidebar__link sidebar__link--disabled" title="Indisponible pendant une partie" data-testid="nav-jingles">Jingles</span>
          } @else {
            <a routerLink="/content/themes" routerLinkActive="active" data-testid="nav-themes">Thèmes</a>
            <a routerLink="/content/questions" routerLinkActive="active" data-testid="nav-questions">Questions</a>
            <a routerLink="/content/quizzes" routerLinkActive="active" data-testid="nav-quizzes">Quiz</a>
            <a routerLink="/content/sounds" routerLinkActive="active" data-testid="nav-jingles">Jingles</a>
          }

          <div class="sidebar__group-label">Parties</div>
          <a routerLink="/games" routerLinkActive="active" data-testid="nav-games">Toutes les parties</a>
        </nav>
      </aside>

      <div class="main">
        <header class="topbar" data-testid="topbar">
          <span class="topbar__server">{{ serverUrl }}</span>
          @if (ws.isConnected()) {
            <span class="topbar__status topbar__status--connected" data-testid="ws-status">
              Connecté
            </span>
          } @else if (ws.isReconnecting()) {
            <span class="topbar__status topbar__status--reconnecting" data-testid="ws-status">
              Reconnexion…
            </span>
          } @else {
            <span class="topbar__status topbar__status--disconnected" data-testid="ws-status">
              Déconnecté
            </span>
          }
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: #212529; color: #fff; padding: 16px 0; display: flex; flex-direction: column; }
    .sidebar nav { display: flex; flex-direction: column; }
    .sidebar a, .sidebar__link { display: block; padding: 10px 20px; color: #adb5bd; text-decoration: none; font-size: 0.9rem; }
    .sidebar a:hover { background: #343a40; color: #fff; }
    .sidebar a.active { background: #0d6efd; color: #fff; }
    .sidebar__group-label { padding: 16px 20px 4px; font-size: 0.7rem; text-transform: uppercase; color: #6c757d; letter-spacing: 0.05em; }
    .sidebar__link--disabled { opacity: 0.4; pointer-events: none; cursor: default; }
    .main { flex: 1; display: flex; flex-direction: column; }
    .topbar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 8px 24px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; font-size: 0.85rem; }
    .topbar__server { color: #6c757d; }
    .topbar__status { display: flex; align-items: center; gap: 6px; }
    .topbar__status::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
    .topbar__status--connected::before { background: #28a745; }
    .topbar__status--reconnecting::before { background: #ffc107; }
    .topbar__status--disconnected::before { background: #dc3545; }
    .content { flex: 1; overflow-y: auto; }
  `],
})
export class AppComponent {
  protected readonly gs = inject(GameStateService);
  protected readonly ws = inject(WebSocketService);
  protected readonly serverUrl = environment.serverUrl || 'localhost';
}
