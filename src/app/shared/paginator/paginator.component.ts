import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, computed, signal } from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="paginator" data-testid="paginator">
      <span class="paginator-info">Page {{ currentPage() }} / {{ totalPages() }}</span>
      <div class="paginator-pages">
        <button
          class="page-btn"
          [disabled]="currentPage() <= 1"
          (click)="onPageChange(currentPage() - 1)"
          data-testid="paginator-prev"
        >&laquo;</button>
        @for (p of pages(); track p) {
          <button
            class="page-btn"
            [class.active]="p === currentPage()"
            (click)="onPageChange(p)"
            [attr.data-testid]="'paginator-page-' + p"
          >{{ p }}</button>
        }
        <button
          class="page-btn"
          [disabled]="currentPage() >= totalPages()"
          (click)="onPageChange(currentPage() + 1)"
          data-testid="paginator-next"
        >&raquo;</button>
      </div>
    </div>
  `,
  styles: [],
})
export class PaginatorComponent {
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);

  @Input() set page(value: number) { this.currentPage.set(value); }
  @Input() set total(value: number) { this.totalPages.set(value); }
  @Output() pageChange = new EventEmitter<number>();

  protected readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  protected onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
