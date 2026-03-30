import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="paginator" data-testid="paginator">
      <span class="paginator-info">Page {{ page() }} / {{ total() }}</span>
      <div class="paginator-pages">
        <button
          class="page-btn"
          [disabled]="page() <= 1"
          (click)="onPageChange(page() - 1)"
          data-testid="paginator-prev"
        >&laquo;</button>
        @for (p of pages(); track p) {
          <button
            class="page-btn"
            [class.active]="p === page()"
            (click)="onPageChange(p)"
            [attr.data-testid]="'paginator-page-' + p"
          >{{ p }}</button>
        }
        <button
          class="page-btn"
          [disabled]="page() >= total()"
          (click)="onPageChange(page() + 1)"
          data-testid="paginator-next"
        >&raquo;</button>
      </div>
    </div>
  `,
  styles: [],
})
export class PaginatorComponent {
  readonly page = input(1);
  readonly total = input(1);
  readonly pageChange = output<number>();

  protected readonly pages = computed(() => {
    const total = this.total();
    const current = this.page();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  protected onPageChange(page: number): void {
    if (page >= 1 && page <= this.total() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}
