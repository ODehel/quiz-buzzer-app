import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="onCancel()" data-testid="confirm-overlay">
        <div class="modal" (click)="$event.stopPropagation()" data-testid="confirm-dialog">
          <div class="modal-body">{{ message() }}</div>
          <div class="modal-actions">
            <button class="btn-modal-cancel" (click)="onCancel()" data-testid="confirm-cancel">Annuler</button>
            <button class="btn-modal-danger" (click)="onConfirm()" data-testid="confirm-ok">Confirmer</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [],
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
