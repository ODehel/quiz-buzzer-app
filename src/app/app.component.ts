import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { GameStateService } from './core/services/game-state.service';
import { WebSocketService } from './core/services/websocket.service';
import { HealthService } from './core/services/health.service';

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
  protected readonly health = inject(HealthService);

  ngOnInit(): void {
    this.health.fetchVersion();
  }
}
