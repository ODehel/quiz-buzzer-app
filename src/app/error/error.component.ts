import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-error',
  standalone: true,
  template: `
    <div class="error-container">
      <h1>Erreur</h1>
      <p>{{ message }}</p>
    </div>
  `,
  styles: [
    `
      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: sans-serif;
      }
      h1 {
        color: #dc3545;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorComponent {
  private readonly route = inject(ActivatedRoute);
  readonly message: string;

  constructor() {
    this.message =
      this.route.snapshot.queryParamMap.get('message') ??
      'Une erreur inattendue est survenue.';
  }
}
