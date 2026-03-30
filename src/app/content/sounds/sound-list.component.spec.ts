import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, NEVER } from 'rxjs';

import { SoundListComponent } from './sound-list.component';
import { SoundService } from './sound.service';
import { ToastService } from '../../core/services/toast.service';
import type { Sound } from '../../core/models/sound.models';
import type { PagedResponse } from '../../core/models/api.models';

const MOCK_SOUND: Sound = {
  id: 's1',
  name: 'Fanfare',
  filename: 'fanfare.mp3',
  url: '/uploads/fanfare.mp3',
  created_at: '2026-03-01T10:00:00.000Z',
};

const MOCK_SOUND_2: Sound = {
  id: 's2',
  name: 'Applause',
  filename: 'applause.wav',
  url: '/uploads/applause.wav',
  created_at: '2026-03-02T10:00:00.000Z',
};

const MOCK_PAGE: PagedResponse<Sound> = {
  data: [MOCK_SOUND, MOCK_SOUND_2],
  page: 1,
  limit: 20,
  total: 2,
  total_pages: 1,
};

const EMPTY_PAGE: PagedResponse<Sound> = {
  data: [],
  page: 1,
  limit: 20,
  total: 0,
  total_pages: 0,
};

describe('SoundListComponent', () => {
  let soundServiceMock: jest.Mocked<Partial<SoundService>>;

  function createComponent(response: PagedResponse<Sound> = MOCK_PAGE) {
    soundServiceMock = {
      getAll: jest.fn().mockReturnValue(of(response)),
      upload: jest.fn().mockResolvedValue(MOCK_SOUND),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        SoundListComponent,
        { provide: SoundService, useValue: soundServiceMock },
      ],
    });

    return TestBed.inject(SoundListComponent);
  }

  // --- CA-1: Initial load calls GET /api/v1/sounds?page=1&limit=20 ---

  it('CA-1: loads sounds on init with page=1 and limit=20', () => {
    createComponent();

    expect(soundServiceMock.getAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  // --- CA-2: Each row shows name and upload date ---

  it('CA-2: stores sounds with name and created_at accessible', () => {
    const component = createComponent();

    expect(component['sounds']()).toHaveLength(2);
    expect(component['sounds']()[0].name).toBe('Fanfare');
    expect(component['sounds']()[0].created_at).toBe('2026-03-01T10:00:00.000Z');
  });

  // --- CA-3: Empty list shows invitation message ---

  it('CA-3: sets empty sounds array when no jingles', () => {
    const component = createComponent(EMPTY_PAGE);

    expect(component['sounds']()).toHaveLength(0);
  });

  // --- CA-4: Upload dialog opens with file name pre-filled ---

  it('CA-4: opens upload dialog and resets state', () => {
    const component = createComponent();

    component['onOpenUpload']();

    expect(component['dialogOpen']()).toBe(true);
    expect(component['uploadName']()).toBe('');
    expect(component['uploadError']()).toBeNull();
  });

  it('CA-4: pre-fills name from selected file name without extension', () => {
    const component = createComponent();
    component['onOpenUpload']();

    const file = new File(['data'], 'my-jingle.mp3', { type: 'audio/mpeg' });
    const event = { target: { files: [file] } } as unknown as Event;

    component['onFileSelected'](event);

    expect(component['uploadName']()).toBe('my-jingle');
    expect(component['canUpload']()).toBe(true);
  });

  // --- CA-5: Local validation for file size and MIME ---

  it('CA-5: rejects files with invalid MIME type', () => {
    const component = createComponent();
    component['onOpenUpload']();

    const file = new File(['data'], 'image.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;

    component['onFileSelected'](event);

    expect(component['uploadError']()).toBe('Format invalide. Formats acceptés : MP3, WAV, OGG');
    expect(component['canUpload']()).toBe(false);
  });

  it('CA-5: rejects files larger than 10 Mo', () => {
    const component = createComponent();
    component['onOpenUpload']();

    // Create a file > 10MB
    const bigData = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([bigData], 'big.mp3', { type: 'audio/mpeg' });
    const event = { target: { files: [file] } } as unknown as Event;

    component['onFileSelected'](event);

    expect(component['uploadError']()).toBe('Fichier trop volumineux (max 10 Mo)');
    expect(component['canUpload']()).toBe(false);
  });

  it('CA-5: accepts valid audio files (wav)', () => {
    const component = createComponent();
    component['onOpenUpload']();

    const file = new File(['data'], 'sound.wav', { type: 'audio/wav' });
    const event = { target: { files: [file] } } as unknown as Event;

    component['onFileSelected'](event);

    expect(component['uploadError']()).toBeNull();
    expect(component['canUpload']()).toBe(true);
  });

  it('CA-5: accepts valid audio files (ogg)', () => {
    const component = createComponent();
    component['onOpenUpload']();

    const file = new File(['data'], 'sound.ogg', { type: 'audio/ogg' });
    const event = { target: { files: [file] } } as unknown as Event;

    component['onFileSelected'](event);

    expect(component['uploadError']()).toBeNull();
    expect(component['canUpload']()).toBe(true);
  });

  // --- CA-6: Successful upload reloads list and shows toast ---

  it('CA-6: uploads and reloads list on success', async () => {
    const component = createComponent();
    component['onOpenUpload']();

    const file = new File(['data'], 'jingle.mp3', { type: 'audio/mpeg' });
    component['selectedFile' as any] = file;
    component['uploadName'].set('Mon jingle');

    await component['onUpload']();

    expect(soundServiceMock.upload).toHaveBeenCalledWith('Mon jingle', file);
    expect(component['dialogOpen']()).toBe(false);
    expect(TestBed.inject(ToastService).message()).toBe('Jingle ajouté');
    // getAll called once initially + once after upload
    expect(soundServiceMock.getAll).toHaveBeenCalledTimes(2);
  });

  // --- CA-7: 409 SOUND_ALREADY_EXISTS shows inline error ---

  it('CA-7: shows inline error on 409 SOUND_ALREADY_EXISTS', async () => {
    const component = createComponent();
    component['onOpenUpload']();

    soundServiceMock.upload!.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { error: 'SOUND_ALREADY_EXISTS', message: 'Already exists' },
      })
    );

    const file = new File(['data'], 'jingle.mp3', { type: 'audio/mpeg' });
    component['selectedFile' as any] = file;
    component['uploadName'].set('Fanfare');

    await component['onUpload']();

    expect(component['uploadError']()).toBe('Un jingle porte déjà ce nom');
    expect(component['dialogOpen']()).toBe(true);
  });

  // --- CA-8: 413 FILE_TOO_LARGE shows inline error ---

  it('CA-8: shows inline error on 413 FILE_TOO_LARGE', async () => {
    const component = createComponent();
    component['onOpenUpload']();

    soundServiceMock.upload!.mockRejectedValue(
      new HttpErrorResponse({
        status: 413,
        error: { error: 'FILE_TOO_LARGE', message: 'Too large' },
      })
    );

    const file = new File(['data'], 'jingle.mp3', { type: 'audio/mpeg' });
    component['selectedFile' as any] = file;
    component['uploadName'].set('Big jingle');

    await component['onUpload']();

    expect(component['uploadError']()).toBe('Fichier trop volumineux');
    expect(component['dialogOpen']()).toBe(true);
  });

  // --- CA-9/CA-10: Delete with confirmation ---

  it('CA-10: deletes sound and reloads list after confirmation', async () => {
    const component = createComponent();

    // Mock the confirm dialog
    component['confirmDialog'] = {
      open: jest.fn().mockResolvedValue(true),
    } as any;

    await component['onDeleteClick'](MOCK_SOUND);

    expect(soundServiceMock.delete).toHaveBeenCalledWith('s1');
    expect(TestBed.inject(ToastService).message()).toBe('Jingle supprimé');
  });

  it('CA-9: does not delete when confirmation is cancelled', async () => {
    const component = createComponent();

    component['confirmDialog'] = {
      open: jest.fn().mockResolvedValue(false),
    } as any;

    await component['onDeleteClick'](MOCK_SOUND);

    expect(soundServiceMock.delete).not.toHaveBeenCalled();
  });

  // --- formatDate ---

  it('formats ISO date to fr-FR locale', () => {
    const component = createComponent();
    const formatted = component['formatDate']('2026-03-01T10:00:00.000Z');
    expect(formatted).toMatch(/01\/03\/2026/);
  });

  // --- Page change ---

  it('reloads sounds when page changes', () => {
    const component = createComponent();

    component['onPageChange'](2);

    // getAll called: initial + page change
    expect(soundServiceMock.getAll).toHaveBeenCalledTimes(2);
    expect(soundServiceMock.getAll).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });

  // --- Close dialog ---

  it('closes dialog on onCloseDialog', () => {
    const component = createComponent();
    component['onOpenUpload']();
    expect(component['dialogOpen']()).toBe(true);

    component['onCloseDialog']();
    expect(component['dialogOpen']()).toBe(false);
  });
});
