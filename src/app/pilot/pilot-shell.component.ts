import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-pilot-shell',
  standalone: true,
  template: '<p>Pilot</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PilotShellComponent {}
