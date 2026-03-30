import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-pilot-shell',
  imports: [RouterOutlet],
  templateUrl: './pilot-shell.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PilotShellComponent {}
