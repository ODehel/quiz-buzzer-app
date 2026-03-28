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

@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [FormsModule, RouterLink, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quiz-list">
      <header class="quiz-list__header">
        <h1>Quiz <span class="total-badge" data-testid="total-count">{{ total() }}</span></h1>
        <a routerLink="/content/quizzes/new" class="btn btn--primary" data-testid="btn-create">
          Nouveau quiz
        </a>
      </header>

      <section class="filters" data-testid="filters">
        <div class="filters__row">
          <label class="filter">
            <span class="filter__label">Rechercher par nom</span>
            <input
              type="text"
              placeholder="Nom du quiz..."
              [ngModel]="filterName()"
              (ngModelChange)="onFilterNameChange($event)"
              data-testid="filter-name"
            />
          </label>
          <button
            class="btn btn--secondary"
            (click)="onResetFilters()"
            data-testid="btn-reset-filters"
          >
            Reinitialiser
          </button>
        </div>
      </section>

      @if (isLoading()) {
        <div class="loading" data-testid="loading">Chargement...</div>
      } @else if (quizzes().length === 0) {
        <p class="empty" data-testid="empty-list">Aucun quiz</p>
      } @else {
        <div class="cards" data-testid="quiz-cards">
          @for (quiz of quizzes(); track quiz.id) {
            <div class="card" data-testid="quiz-card">
              <div class="card__header">
                <h2 class="card__name" data-testid="quiz-name">{{ quiz.name }}</h2>
                <div class="card__actions">
                  <a
                    class="btn btn--sm btn--icon"
                    [routerLink]="'/content/quizzes/' + quiz.id"
                    title="Modifier"
                    data-testid="btn-edit"
                  >&#9998;</a>
                  <button
                    class="btn btn--sm btn--icon btn--danger-icon"
                    (click)="onDeleteClick(quiz)"
                    title="Supprimer"
                    data-testid="btn-delete"
                  >&#128465;</button>
                </div>
              </div>

              <div class="card__total" data-testid="quiz-total">
                {{ quiz.question_summary.total }} questions
              </div>

              <div class="card__summary" data-testid="quiz-summary">
                @for (level of summaryLevels; track level) {
                  @if (quiz.question_summary.by_level[level]) {
                    <div class="summary-row">
                      <span class="summary-level">
                        Niv. {{ level }}
                      </span>
                      <span class="summary-detail">
                        @if (getMcqCount(quiz, level) > 0) {
                          <span class="badge badge--mcq">{{ getMcqCount(quiz, level) }} MCQ</span>
                        }
                        @if (getSpeedCount(quiz, level) > 0) {
                          <span class="badge badge--speed">{{ getSpeedCount(quiz, level) }} SPEED</span>
                        }
                      </span>
                    </div>
                  }
                }
              </div>

              <div class="card__meta" data-testid="quiz-meta">
                <span>Créé le {{ formatDate(quiz.created_at) }}</span>
                @if (quiz.last_updated_at) {
                  <span>· Modifié le {{ formatDate(quiz.last_updated_at) }}</span>
                }
              </div>
            </div>
          }
        </div>

        @if (totalPages() > 1) {
          <app-paginator
            [page]="currentPage()"
            [total]="totalPages()"
            (pageChange)="onPageChange($event)"
          />
        }
      }

      @if (toastMessage()) {
        <div class="toast" [class.toast--error]="toastIsError()" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }

      <app-confirm-dialog />
    </div>
  `,
  styles: [`
    .quiz-list { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .quiz-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .quiz-list__header h1 { margin: 0; font-size: 1.5rem; }
    .total-badge { font-size: 0.85rem; background: #e9ecef; padding: 2px 8px; border-radius: 12px; color: #6c757d; margin-left: 8px; }
    .filters { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .filters__row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .filter { display: flex; flex-direction: column; gap: 4px; flex: 1; max-width: 320px; }
    .filter__label { font-size: 0.75rem; color: #6c757d; }
    .filter input { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.85rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .card__header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card__name { margin: 0; font-size: 1.1rem; font-weight: 600; }
    .card__actions { display: flex; gap: 4px; flex-shrink: 0; }
    .card__total { font-size: 0.95rem; font-weight: 500; color: #495057; }
    .card__summary { display: flex; flex-direction: column; gap: 4px; }
    .summary-row { display: flex; align-items: center; gap: 8px; }
    .summary-level { font-size: 0.8rem; color: #6c757d; min-width: 48px; }
    .summary-detail { display: flex; gap: 4px; }
    .badge { font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .badge--mcq { background: #cce5ff; color: #004085; }
    .badge--speed { background: #d4edda; color: #155724; }
    .card__meta { font-size: 0.75rem; color: #6c757d; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--secondary { background: #e9ecef; color: #495057; }
    .btn--sm { padding: 4px 8px; font-size: 0.8rem; }
    .btn--icon { background: #e9ecef; color: #495057; }
    .btn--danger-icon { background: #f8d7da; color: #842029; }
    .loading { text-align: center; padding: 48px; color: #6c757d; }
    .empty { text-align: center; padding: 48px; color: #6c757d; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #198754; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; }
  `],
})
export class QuizListComponent {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  protected readonly quizzes = signal<Quiz[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(true);

  protected readonly filterName = signal('');

  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

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
              this.showToast('Erreur lors du chargement', true);
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
          this.showToast('Erreur lors du chargement', true);
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
      this.showToast('Quiz supprime');
      this.loadTrigger$.next();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 403 &&
        err.error?.error === 'QUIZ_IN_USE'
      ) {
        this.showToast(
          'Ce quiz est utilise par une partie active',
          true
        );
      } else {
        this.showToast('Erreur lors de la suppression', true);
      }
    }
  }

  protected getMcqCount(quiz: Quiz, level: string): number {
    return quiz.question_summary.by_level[level]?.MCQ ?? 0;
  }

  protected getSpeedCount(quiz: Quiz, level: string): number {
    return quiz.question_summary.by_level[level]?.SPEED ?? 0;
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

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
