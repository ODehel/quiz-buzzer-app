import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Subject, switchMap, catchError, EMPTY } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { QuestionService } from './question.service';
import { ThemeService } from '../themes/theme.service';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import type { Question, QuestionFilters, Theme } from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-question-list',
  imports: [FormsModule, RouterLink, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-list.component.html',
  styleUrl: './question-list.component.css',
})
export class QuestionListComponent {
  private readonly questionService = inject(QuestionService);
  protected readonly toast = inject(ToastService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly questions = signal<Question[]>([]);
  protected readonly themes = signal<Theme[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);

  // Filters
  protected readonly filterThemeId = signal('');
  protected readonly filterType = signal('');
  protected readonly filterLevelMin = signal<number | null>(null);
  protected readonly filterLevelMax = signal<number | null>(null);
  protected readonly filterPointsMin = signal<number | null>(null);
  protected readonly filterPointsMax = signal<number | null>(null);

  // Toast
  protected readonly levelDots = [1, 2, 3, 4, 5];

  protected readonly levelRangeInvalid = computed(() => {
    const min = this.filterLevelMin();
    const max = this.filterLevelMax();
    return min != null && max != null && min > max;
  });

  protected readonly pointsRangeInvalid = computed(() => {
    const min = this.filterPointsMin();
    const max = this.filterPointsMax();
    return min != null && max != null && min > max;
  });

  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          if (this.levelRangeInvalid() || this.pointsRangeInvalid()) {
            return EMPTY;
          }
          this.isLoading.set(true);
          return this.questionService.getAll(this.buildFilters()).pipe(
            catchError(() => {
              this.isLoading.set(false);
              this.toast.show('Erreur lors du chargement', true);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((response: PagedResponse<Question>) => {
        this.questions.set(response.data);
        this.total.set(response.total);
        this.totalPages.set(response.total_pages);
        this.currentPage.set(response.page);
        this.isLoading.set(false);
      });

    forkJoin({
      questions: this.questionService.getAll({ page: 1, limit: 20 }),
      themes: this.themeService.getAll(),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ questions, themes }) => {
          this.questions.set(questions.data);
          this.total.set(questions.total);
          this.totalPages.set(questions.total_pages);
          this.currentPage.set(questions.page);
          this.themes.set(themes.data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.show('Erreur lors du chargement', true);
        },
      });
  }

  protected onFilterChange(
    key: string,
    value: string | number | null
  ): void {
    switch (key) {
      case 'theme_id':
        this.filterThemeId.set(value as string);
        break;
      case 'type':
        this.filterType.set(value as string);
        break;
      case 'level_min':
        this.filterLevelMin.set(value ? Number(value) : null);
        break;
      case 'level_max':
        this.filterLevelMax.set(value ? Number(value) : null);
        break;
      case 'points_min':
        this.filterPointsMin.set(value ? Number(value) : null);
        break;
      case 'points_max':
        this.filterPointsMax.set(value ? Number(value) : null);
        break;
    }
    this.currentPage.set(1);
    this.loadTrigger$.next();
  }

  protected onResetFilters(): void {
    this.filterThemeId.set('');
    this.filterType.set('');
    this.filterLevelMin.set(null);
    this.filterLevelMax.set(null);
    this.filterPointsMin.set(null);
    this.filterPointsMax.set(null);
    this.currentPage.set(1);
    this.loadTrigger$.next();
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTrigger$.next();
  }

  protected async onDeleteClick(question: Question): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer la question "${question.title}" ?`
    );
    if (!confirmed) return;

    try {
      await this.questionService.delete(question.id);
      this.toast.show('Question supprimee');
      this.loadTrigger$.next();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'QUESTION_IN_QUIZ'
      ) {
        this.toast.show(
          'Cette question appartient a un ou plusieurs quiz',
          true
        );
      } else {
        this.toast.show('Erreur lors de la suppression', true);
      }
    }
  }

  protected truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  private buildFilters(): QuestionFilters {
    const filters: QuestionFilters = {
      page: this.currentPage(),
      limit: 20,
    };
    if (this.filterThemeId()) filters.theme_id = this.filterThemeId();
    if (this.filterType())
      filters.type = this.filterType() as 'MCQ' | 'SPEED';
    if (this.filterLevelMin() != null)
      filters.level_min = this.filterLevelMin()!;
    if (this.filterLevelMax() != null)
      filters.level_max = this.filterLevelMax()!;
    if (this.filterPointsMin() != null)
      filters.points_min = this.filterPointsMin()!;
    if (this.filterPointsMax() != null)
      filters.points_max = this.filterPointsMax()!;
    return filters;
  }
}
