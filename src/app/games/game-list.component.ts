import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-game-list',
  standalone: true,
  template: '<p>Games</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameListComponent {}
