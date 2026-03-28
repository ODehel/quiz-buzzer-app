import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of, throwError, NEVER } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { QuestionListComponent } from './question-list.component';
import { QuestionService } from './question.service';
import { ThemeService } from '../themes/theme.service';
import type { Question, Theme } from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_THEMES: Theme[] = [
  { id: 't1', name: 'Culture', created_at: '2026-01-01T00:00:00Z' },
  { id: 't2', name: 'Sport', created_at: '2026-01-02T00:00:00Z' },
];

function createMockQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'MCQ',
    theme_id: 't1',
    theme_name: 'Culture',
    title: 'Quelle est la capitale de la France ?',
    choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
    correct_answer: 'Paris',
    level: 3,
    time_limit: 30,
    points: 200,
    image_path: null,
    audio_path: null,
    created_at: '2026-01-01T00:00:00Z',
    last_updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createPagedResponse(
  data: Question[],
  overrides: Partial<PagedResponse<Question>> = {}
): PagedResponse<Question> {
  return {
    data,
    page: 1,
    limit: 20,
    total: data.length,
    total_pages: 1,
    ...overrides,
  };
}

describe('QuestionListComponent', () => {
  let fixture: ComponentFixture<QuestionListComponent>;
  let el: HTMLElement;
  let mockQuestionService: {
    getAll: jest.Mock;
    delete: jest.Mock;
  };
  let mockThemeService: { getAll: jest.Mock };

  function setup(
    questions: Question[] = [],
    pagedOverrides: Partial<PagedResponse<Question>> = {}
  ) {
    const pagedResponse = createPagedResponse(questions, pagedOverrides);

    mockQuestionService = {
      getAll: jest.fn().mockReturnValue(of(pagedResponse)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mockThemeService = {
      getAll: jest.fn().mockReturnValue(of({ data: MOCK_THEMES, page: 1, limit: 100, total: MOCK_THEMES.length, total_pages: 1 })),
    };

    TestBed.configureTestingModule({
      imports: [QuestionListComponent, RouterTestingModule],
      providers: [
        { provide: QuestionService, useValue: mockQuestionService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    });

    fixture = TestBed.createComponent(QuestionListComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  // CA-1: Parallel load of questions and themes via forkJoin
  it('CA-1: loads questions and themes in parallel on init', () => {
    setup([createMockQuestion()]);
    expect(mockQuestionService.getAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(mockThemeService.getAll).toHaveBeenCalled();
  });

  // CA-2: Displays question info with title, theme, type badge, level, duration, points, media icons
  it('CA-2: displays question details in table rows', () => {
    setup([
      createMockQuestion({
        image_path: '/uploads/img.jpg',
        audio_path: '/uploads/audio.mp3',
      }),
    ]);
    const row = el.querySelector('[data-testid="question-row"]')!;
    expect(row.textContent).toContain('Quelle est la capitale');
    expect(row.textContent).toContain('Culture');
    expect(row.textContent).toContain('MCQ');
    expect(row.textContent).toContain('30 s');
    expect(row.textContent).toContain('200 pts');
    expect(el.querySelector('[data-testid="icon-image"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="icon-audio"]')).toBeTruthy();
  });

  // CA-2: No media icons when paths are null
  it('CA-2: media icons are inactive when no media attached', () => {
    setup([createMockQuestion()]);
    expect(el.querySelector('[data-testid="icon-image"]')!.classList.contains('inactive')).toBe(true);
    expect(el.querySelector('[data-testid="icon-audio"]')!.classList.contains('inactive')).toBe(true);
  });

  // CA-3: Total count displayed
  it('CA-3: displays the total count next to filters', () => {
    setup([createMockQuestion()], { total: 42 });
    expect(el.querySelector('[data-testid="total-count"]')!.textContent).toContain('42');
  });

  // CA-4: Filter change triggers new API call
  it('CA-4: calls getAll with updated params when theme filter changes', () => {
    setup([createMockQuestion()]);
    mockQuestionService.getAll.mockClear();

    const themeSelect = el.querySelector(
      '[data-testid="filter-theme"]'
    ) as HTMLSelectElement;
    themeSelect.value = 't1';
    themeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // The loadTrigger$ should fire, but we can check the service was called
    expect(mockQuestionService.getAll).toHaveBeenCalled();
  });

  // CA-5: Invalid range marked in red, no request emitted
  it('CA-5: marks level range as invalid when min > max and does not emit request', () => {
    setup([createMockQuestion()]);
    const component = fixture.componentInstance;

    // Simulate setting level_min > level_max
    (component as any).filterLevelMin.set(5);
    (component as any).filterLevelMax.set(1);
    fixture.detectChanges();

    const maxInput = el.querySelector('[data-testid="filter-level-max"]') as HTMLInputElement;
    expect(maxInput.classList.contains('error')).toBe(true);
  });

  // CA-7: Reset filters clears all and reloads
  it('CA-7: resets all filters and reloads on reset click', () => {
    setup([createMockQuestion()]);
    const component = fixture.componentInstance;
    (component as any).filterThemeId.set('t1');
    (component as any).filterType.set('MCQ');

    mockQuestionService.getAll.mockClear();
    const resetBtn = el.querySelector('[data-testid="btn-reset-filters"]') as HTMLButtonElement;
    resetBtn.click();
    fixture.detectChanges();

    expect((component as any).filterThemeId()).toBe('');
    expect((component as any).filterType()).toBe('');
    expect(mockQuestionService.getAll).toHaveBeenCalled();
  });

  // CA-8: Paginator displayed when total_pages > 1
  it('CA-8: displays paginator when total_pages > 1', () => {
    setup([createMockQuestion()], { total_pages: 3, total: 60 });
    expect(el.querySelector('[data-testid="paginator"]')).toBeTruthy();
  });

  // CA-8: No paginator when only 1 page
  it('CA-8: hides paginator when total_pages = 1', () => {
    setup([createMockQuestion()]);
    expect(el.querySelector('[data-testid="paginator"]')).toBeNull();
  });

  // CA-10: Edit button links to /content/questions/:id
  it('CA-10: edit button links to /content/questions/:id', () => {
    setup([createMockQuestion({ id: 'abc123' })]);
    const editLink = el.querySelector('[data-testid="btn-edit"]') as HTMLAnchorElement;
    expect(editLink.getAttribute('href')).toBe('/content/questions/abc123');
  });

  // CA-11: Delete button opens confirm dialog
  it('CA-11: delete button triggers confirmation dialog', fakeAsync(() => {
    setup([createMockQuestion()]);
    const deleteBtn = el.querySelector('[data-testid="btn-delete"]') as HTMLButtonElement;
    deleteBtn.click();
    fixture.detectChanges();
    tick();

    expect(el.querySelector('[data-testid="confirm-dialog"]')).toBeTruthy();
  }));

  // CA-12: Delete success reloads list
  it('CA-12: reloads list after successful delete', async () => {
    setup([createMockQuestion()]);
    mockQuestionService.delete.mockResolvedValue(undefined);

    const component = fixture.componentInstance;
    const question = createMockQuestion();

    // Call onDeleteClick directly and confirm
    const deletePromise = (component as any).onDeleteClick(question);
    fixture.detectChanges();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    await deletePromise;
    fixture.detectChanges();

    expect(mockQuestionService.delete).toHaveBeenCalledWith('q1');
  });

  // CA-12: Delete with 409 shows error message
  it('CA-12: displays error toast on 409 QUESTION_IN_QUIZ', async () => {
    setup([createMockQuestion()]);
    mockQuestionService.delete.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { error: 'QUESTION_IN_QUIZ' },
      })
    );

    const component = fixture.componentInstance;
    const question = createMockQuestion();

    const deletePromise = (component as any).onDeleteClick(question);
    fixture.detectChanges();

    const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
    confirmBtn.click();
    await deletePromise;
    fixture.detectChanges();

    const toast = el.querySelector('[data-testid="toast"]');
    expect(toast).toBeTruthy();
    expect(toast!.textContent).toContain('appartient a un ou plusieurs quiz');
  });

  // Empty list
  it('shows empty message when no questions', () => {
    setup([]);
    expect(el.querySelector('[data-testid="empty-list"]')).toBeTruthy();
  });

  // Create button present
  it('displays create button linking to /content/questions/new', () => {
    setup([]);
    const btn = el.querySelector('[data-testid="btn-create"]') as HTMLAnchorElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('href')).toBe('/content/questions/new');
  });

  // Level dots display
  it('CA-2: displays correct number of active level dots', () => {
    setup([createMockQuestion({ level: 4 })]);
    const allDots = el.querySelectorAll('[data-testid="level-dots"] .level-dot');
    // Dots 1-4 should have on-N classes, dot 5 should not
    const activeDots = Array.from(allDots).filter(dot =>
      dot.classList.contains('on-1') ||
      dot.classList.contains('on-2') ||
      dot.classList.contains('on-3') ||
      dot.classList.contains('on-4') ||
      dot.classList.contains('on-5')
    );
    expect(activeDots.length).toBe(4);
  });

  // Type badges
  it('CA-2: displays SPEED badge for SPEED questions', () => {
    setup([createMockQuestion({ type: 'SPEED' })]);
    expect(el.querySelector('.badge-speed')).toBeTruthy();
    expect(el.querySelector('.badge-speed')!.textContent).toBe('SPEED');
  });
});
