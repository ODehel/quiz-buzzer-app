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

@Component({
  selector: 'app-question-list',
  standalone: true,
  imports: [FormsModule, RouterLink, PaginatorComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="question-list">
      <header class="question-list__header">
        <h1>Questions <span class="total-badge" data-testid="total-count">{{ total() }}</span></h1>
        <a routerLink="/content/questions/new" class="btn btn--primary" data-testid="btn-create">
          Nouvelle question
        </a>
      </header>

      <section class="filters" data-testid="filters">
        <div class="filters__row">
          <label class="filter">
            <span class="filter__label">Theme</span>
            <select
              [ngModel]="filterThemeId()"
              (ngModelChange)="onFilterChange('theme_id', $event)"
              data-testid="filter-theme"
            >
              <option value="">Tous</option>
              @for (theme of themes(); track theme.id) {
                <option [value]="theme.id">{{ theme.name }}</option>
              }
            </select>
          </label>
          <label class="filter">
            <span class="filter__label">Type</span>
            <select
              [ngModel]="filterType()"
              (ngModelChange)="onFilterChange('type', $event)"
              data-testid="filter-type"
            >
              <option value="">Tous</option>
              <option value="MCQ">MCQ</option>
              <option value="SPEED">SPEED</option>
            </select>
          </label>
        </div>
        <div class="filters__row">
          <label class="filter">
            <span class="filter__label">Niveau min</span>
            <input
              type="number" min="1" max="5"
              [ngModel]="filterLevelMin()"
              (ngModelChange)="onFilterChange('level_min', $event)"
              data-testid="filter-level-min"
            />
          </label>
          <label class="filter">
            <span class="filter__label">Niveau max</span>
            <input
              type="number" min="1" max="5"
              [ngModel]="filterLevelMax()"
              (ngModelChange)="onFilterChange('level_max', $event)"
              [class.filter--invalid]="levelRangeInvalid()"
              data-testid="filter-level-max"
            />
          </label>
          <label class="filter">
            <span class="filter__label">Points min</span>
            <input
              type="number" min="50" max="500" step="50"
              [ngModel]="filterPointsMin()"
              (ngModelChange)="onFilterChange('points_min', $event)"
              data-testid="filter-points-min"
            />
          </label>
          <label class="filter">
            <span class="filter__label">Points max</span>
            <input
              type="number" min="50" max="500" step="50"
              [ngModel]="filterPointsMax()"
              (ngModelChange)="onFilterChange('points_max', $event)"
              [class.filter--invalid]="pointsRangeInvalid()"
              data-testid="filter-points-max"
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
      } @else if (questions().length === 0) {
        <p class="empty" data-testid="empty-list">Aucune question</p>
      } @else {
        <table class="table" data-testid="questions-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Theme</th>
              <th>Type</th>
              <th>Niveau</th>
              <th>Duree</th>
              <th>Points</th>
              <th>Medias</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (q of questions(); track q.id) {
              <tr data-testid="question-row">
                <td class="title-cell" [title]="q.title">{{ truncate(q.title, 40) }}</td>
                <td>{{ q.theme_name }}</td>
                <td><span class="badge" [class.badge--mcq]="q.type === 'MCQ'" [class.badge--speed]="q.type === 'SPEED'">{{ q.type }}</span></td>
                <td>
                  <span class="level-dots" data-testid="level-dots">
                    @for (dot of levelDots; track dot) {
                      <span class="dot" [class.dot--active]="dot <= q.level"></span>
                    }
                  </span>
                </td>
                <td>{{ q.time_limit }}s</td>
                <td>{{ q.points }} pts</td>
                <td class="media-icons">
                  @if (q.image_path) {
                    <span class="media-icon" title="Image" data-testid="icon-image">&#128247;</span>
                  }
                  @if (q.audio_path) {
                    <span class="media-icon" title="Audio" data-testid="icon-audio">&#127925;</span>
                  }
                </td>
                <td class="actions">
                  <a
                    class="btn btn--sm btn--icon"
                    [routerLink]="'/content/questions/' + q.id"
                    title="Modifier"
                    data-testid="btn-edit"
                  >&#9998;</a>
                  <button
                    class="btn btn--sm btn--icon btn--danger-icon"
                    (click)="onDeleteClick(q)"
                    title="Supprimer"
                    data-testid="btn-delete"
                  >&#128465;</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

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
    .question-list { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .question-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .question-list__header h1 { margin: 0; font-size: 1.5rem; }
    .total-badge { font-size: 0.85rem; background: #e9ecef; padding: 2px 8px; border-radius: 12px; color: #6c757d; margin-left: 8px; }
    .filters { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .filters__row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
    .filters__row:last-child { margin-bottom: 0; }
    .filter { display: flex; flex-direction: column; gap: 4px; }
    .filter__label { font-size: 0.75rem; color: #6c757d; }
    .filter select, .filter input { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.85rem; }
    .filter input { width: 80px; }
    .filter--invalid { border-color: #dc3545 !important; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .table th { font-weight: 600; font-size: 0.85rem; color: #6c757d; }
    .title-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .badge--mcq { background: #cce5ff; color: #004085; }
    .badge--speed { background: #d4edda; color: #155724; }
    .level-dots { display: flex; gap: 3px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #dee2e6; }
    .dot--active { background: #ffc107; }
    .media-icons { display: flex; gap: 4px; }
    .media-icon { font-size: 1rem; }
    .actions { display: flex; gap: 4px; }
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
export class QuestionListComponent {
  private readonly questionService = inject(QuestionService);
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
  protected readonly toastMessage = signal<string | null>(null);
  protected readonly toastIsError = signal(false);

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
              this.showToast('Erreur lors du chargement', true);
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
          this.showToast('Erreur lors du chargement', true);
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
      this.showToast('Question supprimee');
      this.loadTrigger$.next();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 409 &&
        err.error?.error === 'QUESTION_IN_QUIZ'
      ) {
        this.showToast(
          'Cette question appartient a un ou plusieurs quiz',
          true
        );
      } else {
        this.showToast('Erreur lors de la suppression', true);
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

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
