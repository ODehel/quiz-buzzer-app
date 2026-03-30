import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
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
