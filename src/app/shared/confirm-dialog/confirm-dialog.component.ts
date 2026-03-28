import {
  Component,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="overlay" (click)="onCancel()" data-testid="confirm-overlay">
        <div class="dialog" (click)="$event.stopPropagation()" data-testid="confirm-dialog">
          <p class="dialog__message">{{ message() }}</p>
          <div class="dialog__actions">
            <button
              class="btn btn--secondary"
              (click)="onCancel()"
              data-testid="confirm-cancel"
            >
              Annuler
            </button>
            <button
              class="btn btn--danger"
              (click)="onConfirm()"
              data-testid="confirm-ok"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: #fff; border-radius: 8px; padding: 24px; max-width: 400px; width: 90%; }
    .dialog__message { margin: 0 0 16px; font-size: 0.95rem; }
    .dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .btn--secondary { background: #e9ecef; color: #495057; }
    .btn--danger { background: #dc3545; color: #fff; }
  `],
})
export class ConfirmDialogComponent {
  protected readonly isOpen = signal(false);
  protected readonly message = signal('');
  private resolvePromise: ((value: boolean) => void) | null = null;

  open(message: string): Promise<boolean> {
    this.message.set(message);
    this.isOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  protected onConfirm(): void {
    this.isOpen.set(false);
    this.resolvePromise?.(true);
    this.resolvePromise = null;
  }

  protected onCancel(): void {
    this.isOpen.set(false);
    this.resolvePromise?.(false);
    this.resolvePromise = null;
  }
}
