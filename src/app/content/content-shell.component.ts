import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-content-shell',
  imports: [RouterOutlet],
  templateUrl: './content-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentShellComponent {}
