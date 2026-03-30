import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-error',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
  templateUrl: './error.component.html',
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
