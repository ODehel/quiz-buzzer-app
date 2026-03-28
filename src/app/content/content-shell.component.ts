import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-content-shell',
  standalone: true,
  template: '<p>Content</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentShellComponent {}
