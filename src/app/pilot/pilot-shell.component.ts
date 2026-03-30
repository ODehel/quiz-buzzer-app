import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-pilot-shell',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PilotShellComponent {}
