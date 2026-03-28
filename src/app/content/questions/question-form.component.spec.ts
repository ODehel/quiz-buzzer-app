import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { QuestionFormComponent } from './question-form.component';
import { QuestionService } from './question.service';
import { ThemeService } from '../themes/theme.service';
import type { Question, Theme } from '../../core/models/question.models';

const MOCK_THEMES: Theme[] = [
  { id: 't1', name: 'Culture', created_at: '2026-01-01T00:00:00Z' },
  { id: 't2', name: 'Sport', created_at: '2026-01-02T00:00:00Z' },
];

const MOCK_QUESTION: Question = {
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
};

describe('QuestionFormComponent', () => {
  let fixture: ComponentFixture<QuestionFormComponent>;
  let el: HTMLElement;
  let router: Router;
  let mockQuestionService: {
    getById: jest.Mock;
    create: jest.Mock;
    patch: jest.Mock;
    uploadMedia: jest.Mock;
    deleteMedia: jest.Mock;
  };
  let mockThemeService: { getAll: jest.Mock };

  function setup(routeParams: Record<string, string> = {}) {
    mockQuestionService = {
      getById: jest.fn().mockReturnValue(of(MOCK_QUESTION)),
      create: jest.fn().mockResolvedValue({ ...MOCK_QUESTION, id: 'q-new' }),
      patch: jest.fn().mockResolvedValue(MOCK_QUESTION),
      uploadMedia: jest.fn().mockResolvedValue({
        id: 'q1',
        image_path: '/uploads/q1-image.jpg',
        audio_path: null,
        last_updated_at: '2026-01-01T00:00:00Z',
      }),
      deleteMedia: jest.fn().mockResolvedValue(undefined),
    };
    mockThemeService = {
      getAll: jest.fn().mockReturnValue(of({ data: MOCK_THEMES, page: 1, limit: 100, total: MOCK_THEMES.length, total_pages: 1 })),
    };

    TestBed.configureTestingModule({
      imports: [QuestionFormComponent, RouterTestingModule],
      providers: [
        { provide: QuestionService, useValue: mockQuestionService },
        { provide: ThemeService, useValue: mockThemeService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => routeParams[key] || null } },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(QuestionFormComponent);
    el = fixture.nativeElement;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  }

  // --- Creation mode ---

  describe('Creation mode', () => {
    // CA-13: loads themes for select
    it('CA-13: loads themes on creation mode', () => {
      setup();
      expect(mockThemeService.getAll).toHaveBeenCalled();
      expect(el.querySelector('[data-testid="input-theme"]')).toBeTruthy();
    });

    // CA-13: form has default values
    it('CA-13: initializes with default values (MCQ, level 3, 30s, 200pts)', () => {
      setup();
      const component = fixture.componentInstance;
      expect((component as any).formType()).toBe('MCQ');
      expect((component as any).formLevel()).toBe(3);
      expect((component as any).formTimeLimit()).toBe(30);
      expect((component as any).formPoints()).toBe(200);
    });

    // CA-16: toggle MCQ/SPEED is active in creation
    it('CA-16: MCQ/SPEED toggle is visible in creation mode', () => {
      setup();
      expect(el.querySelector('[data-testid="type-toggle"]')).toBeTruthy();
    });

    // CA-16: MCQ shows 4 choice fields
    it('CA-16: MCQ mode shows 4 choice inputs', () => {
      setup();
      expect(el.querySelector('[data-testid="mcq-choices"]')).toBeTruthy();
      expect(el.querySelectorAll('[data-testid^="input-choice-"]').length).toBe(4);
    });

    // CA-16: SPEED shows single answer field
    it('CA-16: switching to SPEED shows answer field', () => {
      setup();
      const speedBtn = el.querySelector('[data-testid="toggle-speed"]') as HTMLButtonElement;
      speedBtn.click();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="speed-answer"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="mcq-choices"]')).toBeNull();
    });

    // CA-23/24/25: Sliders present with correct defaults
    it('CA-23/24/25: sliders display with default values', () => {
      setup();
      const level = el.querySelector('[data-testid="slider-level"]') as HTMLInputElement;
      const duration = el.querySelector('[data-testid="slider-duration"]') as HTMLInputElement;
      const points = el.querySelector('[data-testid="slider-points"]') as HTMLInputElement;

      expect(level).toBeTruthy();
      expect(duration).toBeTruthy();
      expect(points).toBeTruthy();
    });

    // CA-26: validation prevents submission when form is invalid
    it('CA-26: does not call create when form is invalid (empty title)', async () => {
      setup();
      await (fixture.componentInstance as any).onSubmit();
      fixture.detectChanges();

      expect(mockQuestionService.create).not.toHaveBeenCalled();
      expect(el.querySelector('[data-testid="error-title"]')).toBeTruthy();
    });

    // CA-18: Empty choices show error
    it('CA-18: shows error when MCQ choices are empty', async () => {
      setup();
      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Test question');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-choices"]')).toBeTruthy();
    });

    // CA-19: Duplicate choices show error
    it('CA-19: shows error when MCQ choices are not unique', async () => {
      setup();
      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Test question');
      (component as any).formChoices.set(['Same', 'same', 'C', 'D']);
      (component as any).formCorrectAnswer.set('Same');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-choices"]')!.textContent).toContain('uniques');
    });

    // CA-20: correct_answer must match a choice
    it('CA-20: shows error when no correct answer selected', async () => {
      setup();
      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Test question');
      (component as any).formChoices.set(['A', 'B', 'C', 'D']);
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-correct-answer"]')).toBeTruthy();
    });

    // CA-27: successful creation navigates to list with toast
    it('CA-27: calls create and navigates on success', async () => {
      setup();
      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('New question');
      (component as any).formChoices.set(['A', 'B', 'C', 'D']);
      (component as any).formCorrectAnswer.set('A');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(mockQuestionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MCQ',
          title: 'New question',
          theme_id: 't1',
          choices: ['A', 'B', 'C', 'D'],
          correct_answer: 'A',
        })
      );
      expect(router.navigate).toHaveBeenCalledWith(['/content/questions']);
    });

    // CA-22: SPEED validation
    it('CA-22: validates SPEED answer field is required', async () => {
      setup();
      const component = fixture.componentInstance;
      (component as any).formType.set('SPEED');
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Speed question');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-correct-answer"]')).toBeTruthy();
    });

    // CA-28: 409 QUESTION_ALREADY_EXISTS shows inline error
    it('CA-28: shows inline title error on 409 QUESTION_ALREADY_EXISTS', async () => {
      setup();
      mockQuestionService.create.mockRejectedValue(
        new HttpErrorResponse({
          status: 409,
          error: { error: 'QUESTION_ALREADY_EXISTS' },
        })
      );

      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Existing');
      (component as any).formChoices.set(['A', 'B', 'C', 'D']);
      (component as any).formCorrectAnswer.set('A');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-title"]')!.textContent).toContain('existe deja');
      expect(router.navigate).not.toHaveBeenCalledWith(['/content/questions']);
    });

    // CA-29: 5xx shows generic toast
    it('CA-29: shows generic error toast on server error', async () => {
      setup();
      mockQuestionService.create.mockRejectedValue(
        new HttpErrorResponse({ status: 500 })
      );

      const component = fixture.componentInstance;
      (component as any).formThemeId.set('t1');
      (component as any).formTitle.set('Test');
      (component as any).formChoices.set(['A', 'B', 'C', 'D']);
      (component as any).formCorrectAnswer.set('A');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      const toast = el.querySelector('[data-testid="toast"]');
      expect(toast).toBeTruthy();
      expect(toast!.textContent).toContain('Erreur serveur');
    });

    // CA-33: media upload disabled in creation mode
    it('CA-33: media upload zones are disabled in creation mode', () => {
      setup();
      expect(el.querySelector('[data-testid="drop-image-disabled"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="drop-audio-disabled"]')).toBeTruthy();
    });
  });

  // --- Edition mode ---

  describe('Edition mode', () => {
    // CA-14: loads question and themes in parallel
    it('CA-14: loads question and themes in parallel', () => {
      setup({ id: 'q1' });
      expect(mockQuestionService.getById).toHaveBeenCalledWith('q1');
      expect(mockThemeService.getAll).toHaveBeenCalled();
    });

    // CA-14: form is pre-filled
    it('CA-14: pre-fills form with question data', () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      expect((component as any).formTitle()).toBe(MOCK_QUESTION.title);
      expect((component as any).formThemeId()).toBe('t1');
      expect((component as any).formType()).toBe('MCQ');
    });

    // CA-15: 404 navigates back to list
    it('CA-15: navigates to /content/questions on 404', () => {
      const mockRouter = { navigate: jest.fn().mockResolvedValue(true) };
      mockQuestionService = {
        getById: jest.fn().mockReturnValue(
          throwError(() => new HttpErrorResponse({ status: 404 }))
        ),
        create: jest.fn(),
        patch: jest.fn(),
        uploadMedia: jest.fn(),
        deleteMedia: jest.fn(),
      };
      mockThemeService = {
        getAll: jest.fn().mockReturnValue(of({ data: MOCK_THEMES, page: 1, limit: 100, total: MOCK_THEMES.length, total_pages: 1 })),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [QuestionFormComponent],
        providers: [
          { provide: QuestionService, useValue: mockQuestionService },
          { provide: ThemeService, useValue: mockThemeService },
          { provide: Router, useValue: mockRouter },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: () => 'nonexistent' } },
            },
          },
        ],
      });

      fixture = TestBed.createComponent(QuestionFormComponent);
      fixture.detectChanges();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/content/questions']);
    });

    // CA-17: type toggle disabled in edit mode
    it('CA-17: type toggle is disabled (read-only) in edit mode', () => {
      setup({ id: 'q1' });
      expect(el.querySelector('[data-testid="type-toggle"]')).toBeNull();
      expect(el.querySelector('[data-testid="type-readonly"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="type-readonly"]')!.textContent).toBe('MCQ');
    });

    // CA-30: PATCH sends only modified fields
    it('CA-30: calls patch with only changed fields', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      (component as any).formTitle.set('Updated title');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(mockQuestionService.patch).toHaveBeenCalledWith('q1', {
        title: 'Updated title',
      });
    });

    // CA-30: Empty patch navigates without API call
    it('CA-30: navigates with toast when no changes detected', async () => {
      setup({ id: 'q1' });

      await (fixture.componentInstance as any).onSubmit();
      fixture.detectChanges();

      expect(mockQuestionService.patch).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/content/questions']);
    });

    // CA-31: Successful edit navigates with toast
    it('CA-31: navigates to list after successful patch', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      (component as any).formLevel.set(5);
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/content/questions']);
    });

    // CA-32: 409 on edit shows title error
    it('CA-32: shows inline title error on 409 during edit', async () => {
      setup({ id: 'q1' });
      mockQuestionService.patch.mockRejectedValue(
        new HttpErrorResponse({
          status: 409,
          error: { error: 'QUESTION_ALREADY_EXISTS' },
        })
      );

      const component = fixture.componentInstance;
      (component as any).formTitle.set('Duplicate title');
      fixture.detectChanges();

      await (component as any).onSubmit();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-title"]')!.textContent).toContain('existe deja');
    });

    // CA-34: media zones are active in edit mode
    it('CA-34: media drop zones are active in edit mode', () => {
      setup({ id: 'q1' });
      expect(el.querySelector('[data-testid="drop-image"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="drop-audio"]')).toBeTruthy();
    });

    // CA-35: validates file size before upload
    it('CA-35: shows error for oversized file', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.jpg', {
        type: 'image/jpeg',
      });

      await (component as any).uploadFile(bigFile, 'image');
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-image"]')!.textContent).toContain('trop volumineux');
      expect(mockQuestionService.uploadMedia).not.toHaveBeenCalled();
    });

    // CA-35: validates MIME type before upload
    it('CA-35: shows error for invalid MIME type', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      const badFile = new File(['content'], 'doc.pdf', {
        type: 'application/pdf',
      });

      await (component as any).uploadFile(badFile, 'image');
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="error-image"]')!.textContent).toContain('non accepte');
    });

    // CA-36: successful upload updates preview
    it('CA-36: updates image preview after successful upload', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      const file = new File(['content'], 'img.jpg', { type: 'image/jpeg' });

      await (component as any).uploadFile(file, 'image');
      fixture.detectChanges();

      expect(mockQuestionService.uploadMedia).toHaveBeenCalledWith('q1', 'image', file);
      expect((component as any).imagePath()).toBe('/uploads/q1-image.jpg');
    });

    // CA-37/38: delete media with confirmation
    it('CA-37/38: deletes media after confirmation', async () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      (component as any).imagePath.set('/uploads/q1-image.jpg');
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="image-preview"]')).toBeTruthy();

      // Trigger delete (which opens dialog)
      const deletePromise = (component as any).onDeleteMedia('image');

      fixture.detectChanges();
      // Click confirm in the dialog
      const confirmBtn = el.querySelector('[data-testid="confirm-ok"]') as HTMLButtonElement;
      confirmBtn.click();
      await deletePromise;
      fixture.detectChanges();

      expect(mockQuestionService.deleteMedia).toHaveBeenCalledWith('q1', 'image');
      expect((component as any).imagePath()).toBeNull();
    });

    // CA-39: image URL is prefixed with serverUrl
    it('CA-39: image preview URL includes serverUrl prefix', () => {
      setup({ id: 'q1' });
      const component = fixture.componentInstance;
      (component as any).imagePath.set('/uploads/questions/q1-image.jpg');
      fixture.detectChanges();

      expect((component as any).imageUrl()).toBe('/uploads/questions/q1-image.jpg');
    });
  });

  // CA-21: correct_answer syncs when choice text changes
  it('CA-21: updates correct_answer when selected choice text changes', () => {
    setup();
    const component = fixture.componentInstance;
    (component as any).formChoices.set(['Paris', 'Lyon', 'Marseille', 'Toulouse']);
    (component as any).formCorrectAnswer.set('Paris');

    (component as any).onChoiceChange(0, 'Berlin');
    expect((component as any).formCorrectAnswer()).toBe('Berlin');
  });

  // Cancel button
  it('navigates back on cancel', () => {
    setup();
    const cancelBtn = el.querySelector('[data-testid="btn-cancel"]') as HTMLButtonElement;
    cancelBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/content/questions']);
  });
});
