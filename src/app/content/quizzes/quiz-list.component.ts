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
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Quiz
        <span style="font-size:16px;color:var(--muted);font-weight:400;font-family:'DM Sans'"
              data-testid="total-count">({{ total() }})</span>
      </h1>
      <a routerLink="/content/quizzes/new" class="btn-primary" data-testid="btn-create">
        <svg style="width:14px;height:14px;fill:#fff" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Nouveau quiz
      </a>
    </div>

    <!-- Search bar -->
    <div class="search-bar" data-testid="filters">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input
          type="text"
          class="search-input"
          placeholder="Rechercher par nom\u2026"
          [ngModel]="filterName()"
          (ngModelChange)="onFilterNameChange($event)"
          data-testid="filter-name"
        />
      </div>
      <span class="search-count"><strong>{{ total() }}</strong> r\u00e9sultats</span>
    </div>

    @if (isLoading()) {
      <div class="loading" data-testid="loading">Chargement...</div>
    } @else if (quizzes().length === 0) {
      <p class="empty" data-testid="empty-list">Aucun quiz</p>
    } @else {
      <div class="quiz-grid" data-testid="quiz-cards">
        @for (quiz of quizzes(); track quiz.id) {
          <div class="quiz-card" [class.in-use]="isInUse(quiz)" data-testid="quiz-card">
            <div class="card-top">
              @if (isInUse(quiz)) {
                <div class="in-use-badge">
                  <div class="in-use-dot"></div>
                  Partie active
                </div>
              }
              <div class="card-name" data-testid="quiz-name">{{ quiz.name }}</div>
              <div class="card-date" data-testid="quiz-meta">
                Cr\u00e9\u00e9 le {{ formatDate(quiz.created_at) }}
                @if (quiz.last_updated_at) {
                  &middot; mis \u00e0 jour {{ formatDate(quiz.last_updated_at) }}
                }
              </div>

              <!-- Stats -->
              <div class="card-stats" data-testid="quiz-total">
                <div>
                  <div class="stat-total">{{ quiz.question_summary.total }}</div>
                  <div class="stat-total-label">questions</div>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-types">
                  <div class="stat-type-row">
                    <div class="stat-type-dot dot-mcq"></div>
                    <span class="stat-type-label">MCQ</span>
                    <span class="stat-type-count">{{ getTotalByType(quiz, 'MCQ') }}</span>
                  </div>
                  <div class="stat-type-row">
                    <div class="stat-type-dot dot-speed"></div>
                    <span class="stat-type-label">SPEED</span>
                    <span class="stat-type-count">{{ getTotalByType(quiz, 'SPEED') }}</span>
                  </div>
                </div>
              </div>

              <!-- Level distribution bars -->
              <div class="level-bars" data-testid="quiz-summary">
                @for (level of summaryLevels; track level) {
                  <div class="level-bar-row">
                    <span class="level-bar-label">{{ level }}</span>
                    <div class="level-bar-track">
                      <div
                        class="level-bar-fill bar-{{ level }}"
                        [style.width.%]="getLevelPercent(quiz, level)"
                      ></div>
                    </div>
                    <span class="level-bar-count">{{ getLevelTotal(quiz, level) }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Actions -->
            <div class="card-actions">
              <a
                class="card-action-btn"
                [routerLink]="'/content/quizzes/' + quiz.id"
                title="Modifier"
                data-testid="btn-edit"
              >
                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Modifier
              </a>
              <button
                class="card-action-btn danger"
                (click)="onDeleteClick(quiz)"
                title="Supprimer"
                data-testid="btn-delete"
              >
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Supprimer
              </button>
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
      <div class="toast-error" [style.display]="toastMessage() ? 'flex' : 'none'" data-testid="toast">
        @if (toastIsError()) {
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        }
        {{ toastMessage() }}
      </div>
    }

    <app-confirm-dialog />
  `,
  styles: [],
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

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
