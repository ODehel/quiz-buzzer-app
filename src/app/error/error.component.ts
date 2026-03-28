import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-error',
  standalone: true,
  template: `
    <div class="error-container">
      <h1>Erreur</h1>
      <p>{{ message() }}</p>
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly message = signal<string>(
    this.router.getCurrentNavigation()?.extras.state?.['message']
      ?? this.route.snapshot.queryParamMap.get('message')
      ?? "Une erreur inattendue s'est produite."
  );
}
