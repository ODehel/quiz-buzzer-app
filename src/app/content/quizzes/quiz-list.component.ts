import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, EMPTY } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { QuizService } from './quiz.service';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import type { Quiz, QuizFilters } from '../../core/models/quiz.models';
import type { PagedResponse } from '../../core/models/api.models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-quiz-list',
  imports: [FormsModule, RouterLink, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-list.component.html',
  styles: [],
})
export class QuizListComponent {
  private readonly quizService = inject(QuizService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly quizzes = signal<Quiz[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);

  protected readonly filterName = signal('');
  protected readonly summaryLevels = ['1', '2', '3', '4', '5'];

  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          return this.quizService.getAll(this.buildFilters()).pipe(
            catchError(() => {
              this.isLoading.set(false);
              this.toast.show('Erreur lors du chargement', true);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((response: PagedResponse<Quiz>) => {
        this.quizzes.set(response.data);
        this.total.set(response.total);
        this.totalPages.set(response.total_pages);
        this.currentPage.set(response.page);
        this.isLoading.set(false);
      });

    this.quizService
      .getAll({ page: 1, limit: 20 })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (response) => {
          this.quizzes.set(response.data);
          this.total.set(response.total);
          this.totalPages.set(response.total_pages);
          this.currentPage.set(response.page);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.show('Erreur lors du chargement', true);
        },
      });
  }

  protected onFilterNameChange(value: string): void {
    this.filterName.set(value);
    this.currentPage.set(1);
    this.loadTrigger$.next();
  }

  protected onResetFilters(): void {
    this.filterName.set('');
    this.currentPage.set(1);
    this.loadTrigger$.next();
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTrigger$.next();
  }

  protected async onDeleteClick(quiz: Quiz): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      `Supprimer le quiz "${quiz.name}" ?`
    );
    if (!confirmed) return;

    try {
      await this.quizService.delete(quiz.id);
      this.toast.show('Quiz supprime');
      this.loadTrigger$.next();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 403 &&
        err.error?.error === 'QUIZ_IN_USE'
      ) {
        this.toast.show(
          'Ce quiz est utilise par une partie active',
          true
        );
      } else {
        this.toast.show('Erreur lors de la suppression', true);
      }
    }
  }

  protected isInUse(quiz: Quiz): boolean {
    return !!(quiz as any).in_use;
  }

  protected getMcqCount(quiz: Quiz, level: string): number {
    return quiz.question_summary.by_level[level]?.MCQ ?? 0;
  }

  protected getSpeedCount(quiz: Quiz, level: string): number {
    return quiz.question_summary.by_level[level]?.SPEED ?? 0;
  }

  protected getTotalByType(quiz: Quiz, type: 'MCQ' | 'SPEED'): number {
    let count = 0;
    for (const level of this.summaryLevels) {
      count += (quiz.question_summary.by_level[level] as any)?.[type] ?? 0;
    }
    return count;
  }

  protected getLevelTotal(quiz: Quiz, level: string): number {
    return this.getMcqCount(quiz, level) + this.getSpeedCount(quiz, level);
  }

  protected getLevelPercent(quiz: Quiz, level: string): number {
    const total = quiz.question_summary.total;
    if (total === 0) return 0;
    return (this.getLevelTotal(quiz, level) / total) * 100;
  }

  protected formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return "aujourd'hui";
    if (isYesterday) return 'hier';
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private buildFilters(): QuizFilters {
    const filters: QuizFilters = {
      page: this.currentPage(),
      limit: 20,
    };
    if (this.filterName()) filters.name = this.filterName();
    return filters;
  }
}
