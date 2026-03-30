import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);

  show(message: string, isError = false): void {
    this.message.set(message);
    this.isError.set(isError);
    setTimeout(() => this.message.set(null), 4000);
  }
}
