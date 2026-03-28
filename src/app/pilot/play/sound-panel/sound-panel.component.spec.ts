import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SoundPanelComponent } from './sound-panel.component';
import { SoundService } from '../../../content/sounds/sound.service';
import { GameStateService } from '../../../core/services/game-state.service';
import type { Sound } from '../../../core/models/sound.models';
import type { PagedResponse } from '../../../core/models/api.models';

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
  limit: 100,
  total: 2,
  total_pages: 1,
};

describe('SoundPanelComponent', () => {
  let soundServiceMock: jest.Mocked<Partial<SoundService>>;
  let gsStub: Partial<GameStateService>;

  function createComponent(soundResponse: PagedResponse<Sound> = MOCK_PAGE) {
    soundServiceMock = {
      getAll: jest.fn().mockReturnValue(of(soundResponse)),
    };

    gsStub = {
      connectedBuzzers: jest.fn().mockReturnValue(['buzzer-1', 'buzzer-2']) as any,
    };

    TestBed.configureTestingModule({
      providers: [
        SoundPanelComponent,
        { provide: SoundService, useValue: soundServiceMock },
        { provide: GameStateService, useValue: gsStub },
      ],
    });

    return TestBed.inject(SoundPanelComponent);
  }

  // --- Loads jingles from SoundService.getAll() at mount ---

  it('loads jingles with limit=100 on init', () => {
    createComponent();

    expect(soundServiceMock.getAll).toHaveBeenCalledWith({ limit: 100 });
  });

  it('stores loaded sounds in signal', () => {
    const component = createComponent();

    expect(component['sounds']()).toHaveLength(2);
    expect(component['sounds']()[0].name).toBe('Fanfare');
  });

  // --- System sound buttons emit via Output ---

  it('emits trigger_system_sound WAITING via triggerSystemSound output', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.triggerSystemSound.subscribe(spy);

    component['onTriggerSystemSound']('WAITING');

    expect(spy).toHaveBeenCalledWith({
      type: 'trigger_system_sound',
      sound_id: 'WAITING',
    });
  });

  it('emits trigger_system_sound SUSPENSE via triggerSystemSound output', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.triggerSystemSound.subscribe(spy);

    component['onTriggerSystemSound']('SUSPENSE');

    expect(spy).toHaveBeenCalledWith({
      type: 'trigger_system_sound',
      sound_id: 'SUSPENSE',
    });
  });

  // --- Send jingle via Output ---

  it('emits play_sound with targets when a specific buzzer is selected', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.playSound.subscribe(spy);
    component['selectedId'].set('s1');
    component['selectedTarget'].set('buzzer-1');

    component['onSendJingle']();

    expect(spy).toHaveBeenCalledWith({
      type: 'play_sound',
      sound_id: 's1',
      targets: ['buzzer-1'],
    });
  });

  it('emits play_sound without targets when ALL is selected (broadcast)', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.playSound.subscribe(spy);
    component['selectedId'].set('s1');
    component['selectedTarget'].set('ALL');

    component['onSendJingle']();

    expect(spy).toHaveBeenCalledWith({
      type: 'play_sound',
      sound_id: 's1',
    });
  });

  // --- Send button disabled when no jingle selected ---

  it('canSend is false when no jingle is selected', () => {
    const component = createComponent();

    expect(component['canSend']()).toBe(false);
  });

  it('canSend is true when a jingle is selected', () => {
    const component = createComponent();
    component['selectedId'].set('s1');

    expect(component['canSend']()).toBe(true);
  });

  // --- CA-35/CA-36: Ranking button ---

  it('CA-35/CA-36 — triggerRanking output exists', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.triggerRanking.subscribe(spy);

    component.triggerRanking.emit();

    expect(spy).toHaveBeenCalled();
  });

  // --- onSendJingle does nothing when no id selected ---

  it('does not emit when selectedId is null', () => {
    const component = createComponent();
    const spy = jest.fn();
    component.playSound.subscribe(spy);
    component['selectedId'].set(null);

    component['onSendJingle']();

    expect(spy).not.toHaveBeenCalled();
  });

  // --- Error loading sounds ---

  it('shows toast when loading sounds fails', () => {
    soundServiceMock = {
      getAll: jest.fn().mockReturnValue(throwError(() => new Error('Network error'))),
    };

    gsStub = {
      connectedBuzzers: jest.fn().mockReturnValue([]) as any,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SoundPanelComponent,
        { provide: SoundService, useValue: soundServiceMock },
        { provide: GameStateService, useValue: gsStub },
      ],
    });

    const component = TestBed.inject(SoundPanelComponent);
    expect(component['toastMessage']()).toBe('Erreur lors du chargement des jingles');
  });

  // --- showToast ---

  it('showToast sets and clears message', () => {
    jest.useFakeTimers();
    const component = createComponent();

    component.showToast('Test message');
    expect(component['toastMessage']()).toBe('Test message');

    jest.advanceTimersByTime(4000);
    expect(component['toastMessage']()).toBeNull();

    jest.useRealTimers();
  });
});
