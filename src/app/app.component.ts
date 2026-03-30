import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { GameStateService } from './core/services/game-state.service';
import { WebSocketService } from './core/services/websocket.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './app.component.html',
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
