import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { GameStateService } from './core/services/game-state.service';
import { WebSocketService } from './core/services/websocket.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  template: `
    <div class="app-shell">
      <header class="topbar" data-testid="topbar">
        <div class="topbar-logo">Quiz<span>Buzzer</span></div>
        <div class="topbar-spacer"></div>
        <div class="topbar-server">
          @if (ws.isConnected()) {
            <div class="ws-dot" data-testid="ws-status"></div>
            <span class="ws-label">Connecté</span>
          } @else if (ws.isReconnecting()) {
            <div class="ws-dot ws-dot--reconnecting" data-testid="ws-status"></div>
            <span class="ws-label ws-label--warn">Reconnexion…</span>
          } @else {
            <div class="ws-dot" style="background:var(--red);box-shadow:0 0 6px var(--red)" data-testid="ws-status"></div>
            <span class="ws-label" style="color:var(--red)">Déconnecté</span>
          }
          <span style="color:var(--border)">|</span>
          <span>{{ serverUrl }}</span>
        </div>
        @if (serverVersion()) {
          <div class="topbar-version">{{ serverVersion() }}</div>
        }
      </header>

      <div class="layout">
        <nav class="sidebar" data-testid="sidebar">
          <div class="nav-section-label">Navigation</div>
          <a class="nav-link" routerLink="/dashboard" routerLinkActive="active" data-testid="nav-dashboard">
            <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            Tableau de bord
          </a>

          <div class="nav-divider"></div>
          <div class="nav-section-label">Contenu</div>

          @if (gs.isPiloting()) {
            <span class="nav-link disabled" title="Indisponible pendant une partie" data-testid="nav-themes">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>
              Thèmes
            </span>
            <span class="nav-link disabled" title="Indisponible pendant une partie" data-testid="nav-questions">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
              Questions
            </span>
            <span class="nav-link disabled" title="Indisponible pendant une partie" data-testid="nav-quizzes">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
              Quiz
            </span>
            <span class="nav-link disabled" title="Indisponible pendant une partie" data-testid="nav-jingles">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
              Jingles
            </span>
          } @else {
            <a class="nav-link" routerLink="/content/themes" routerLinkActive="active" data-testid="nav-themes">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>
              Thèmes
            </a>
            <a class="nav-link" routerLink="/content/questions" routerLinkActive="active" data-testid="nav-questions">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
              Questions
            </a>
            <a class="nav-link" routerLink="/content/quizzes" routerLinkActive="active" data-testid="nav-quizzes">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
              Quiz
            </a>
            <a class="nav-link" routerLink="/content/sounds" routerLinkActive="active" data-testid="nav-jingles">
              <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
              Jingles
            </a>
          }

          <div class="nav-divider"></div>
          <div class="nav-section-label">Parties</div>
          <a class="nav-link" routerLink="/games" routerLinkActive="active" data-testid="nav-games">
            <svg class="icon nav-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
            Toutes les parties
          </a>

          <div style="flex:1"></div>

          @if (gs.isPiloting()) {
            <div class="sidebar-game-card">
              <div class="sidebar-game-label">PARTIE EN COURS</div>
              <div class="sidebar-game-name">{{ gs.state().quizId || 'Partie active' }}</div>
              <a routerLink="/pilot/play" class="sidebar-game-btn">Reprendre →</a>
            </div>
          }
        </nav>

        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppComponent implements OnInit {
  protected readonly gs = inject(GameStateService);
  protected readonly ws = inject(WebSocketService);
  protected readonly serverUrl = environment.serverUrl || 'localhost';
  protected readonly serverVersion = signal<string>('');
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.http.get<{ version?: string }>('/api/v1/health').subscribe({
      next: (res) => this.serverVersion.set(res.version ? `v${res.version}` : ''),
      error: () => this.serverVersion.set(''),
    });
  }
}
