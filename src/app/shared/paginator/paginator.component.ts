import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="paginator" data-testid="paginator">
      <button
        class="paginator__btn"
        [disabled]="currentPage() <= 1"
        (click)="onPageChange(currentPage() - 1)"
        data-testid="paginator-prev"
      >
        &laquo;
      </button>
      @for (p of pages(); track p) {
        <button
          class="paginator__btn"
          [class.paginator__btn--active]="p === currentPage()"
          (click)="onPageChange(p)"
          [attr.data-testid]="'paginator-page-' + p"
        >
          {{ p }}
        </button>
      }
      <button
        class="paginator__btn"
        [disabled]="currentPage() >= totalPages()"
        (click)="onPageChange(currentPage() + 1)"
        data-testid="paginator-next"
      >
        &raquo;
      </button>
    </nav>
  `,
  styles: [`
    .paginator { display: flex; gap: 4px; align-items: center; }
    .paginator__btn { padding: 6px 12px; border: 1px solid #dee2e6; background: #fff; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
    .paginator__btn:disabled { opacity: 0.4; cursor: default; }
    .paginator__btn--active { background: #0d6efd; color: #fff; border-color: #0d6efd; }
  `],
})
export class PaginatorComponent {
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);

  @Input() set page(value: number) {
    this.currentPage.set(value);
  }

  @Input() set total(value: number) {
    this.totalPages.set(value);
  }

  @Output() pageChange = new EventEmitter<number>();

  protected readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  protected onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
