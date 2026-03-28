import { TestBed } from '@angular/core/testing';
import { of, Subject, NEVER, throwError } from 'rxjs';

import { SoundPanelComponent } from './sound-panel.component';
import { SoundService } from '../../../content/sounds/sound.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { GameStateService } from '../../../core/services/game-state.service';
import type { Sound } from '../../../core/models/sound.models';
import type { PagedResponse } from '../../../core/models/api.models';
import type { InboundMessage } from '../../../core/models/websocket.models';

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
  let wsMock: { send: jest.Mock; messages$: Subject<InboundMessage>; isConnected: jest.Mock; isReconnecting: jest.Mock };
  let soundServiceMock: jest.Mocked<Partial<SoundService>>;
  let gsStub: Partial<GameStateService>;
  let messagesSubject: Subject<InboundMessage>;

  function createComponent(soundResponse: PagedResponse<Sound> = MOCK_PAGE) {
    messagesSubject = new Subject<InboundMessage>();
    wsMock = {
      send: jest.fn(),
      messages$: messagesSubject,
      isConnected: jest.fn().mockReturnValue(true),
      isReconnecting: jest.fn().mockReturnValue(false),
    };

    soundServiceMock = {
      getAll: jest.fn().mockReturnValue(of(soundResponse)),
    };

    gsStub = {
      connectedBuzzers: jest.fn().mockReturnValue(['buzzer-1', 'buzzer-2']) as any,
    };

    TestBed.configureTestingModule({
      providers: [
        SoundPanelComponent,
        { provide: WebSocketService, useValue: wsMock },
        { provide: SoundService, useValue: soundServiceMock },
        { provide: GameStateService, useValue: gsStub },
      ],
    });

    return TestBed.inject(SoundPanelComponent);
  }

  // --- CA-15: Loads jingles from SoundService.getAll() at mount ---

  it('CA-15: loads jingles with limit=100 on init', () => {
    createComponent();

    expect(soundServiceMock.getAll).toHaveBeenCalledWith({ limit: 100 });
  });

  it('CA-15: stores loaded sounds in signal', () => {
    const component = createComponent();

    expect(component['sounds']()).toHaveLength(2);
    expect(component['sounds']()[0].name).toBe('Fanfare');
  });

  // --- CA-11: Two system sound buttons ---

  // --- CA-12: Waiting button sends trigger_system_sound WAITING ---

  it('CA-12: sends trigger_system_sound WAITING via WebSocket', () => {
    const component = createComponent();

    component['onTriggerSystemSound']('WAITING');

    expect(wsMock.send).toHaveBeenCalledWith({
      type: 'trigger_system_sound',
      sound_id: 'WAITING',
    });
  });

  // --- CA-13: Suspense button sends trigger_system_sound SUSPENSE ---

  it('CA-13: sends trigger_system_sound SUSPENSE via WebSocket', () => {
    const component = createComponent();

    component['onTriggerSystemSound']('SUSPENSE');

    expect(wsMock.send).toHaveBeenCalledWith({
      type: 'trigger_system_sound',
      sound_id: 'SUSPENSE',
    });
  });

  // --- CA-14: UNKNOWN_SYSTEM_SOUND error shows toast ---

  it('CA-14: shows toast on UNKNOWN_SYSTEM_SOUND error', () => {
    const component = createComponent();

    messagesSubject.next({ type: 'error', code: 'UNKNOWN_SYSTEM_SOUND' } as any);

    expect(component['toastMessage']()).toBe('Son système inconnu');
  });

  // --- CA-17: Send jingle with targets (specific buzzer) ---

  it('CA-17: sends play_sound with targets when a specific buzzer is selected', () => {
    const component = createComponent();
    component['selectedId'].set('s1');
    component['selectedTarget'].set('buzzer-1');

    component['onSendJingle']();

    expect(wsMock.send).toHaveBeenCalledWith({
      type: 'play_sound',
      sound_id: 's1',
      targets: ['buzzer-1'],
    });
  });

  // --- CA-17: Send jingle broadcast (ALL) ---

  it('CA-17: sends play_sound without targets when ALL is selected (broadcast)', () => {
    const component = createComponent();
    component['selectedId'].set('s1');
    component['selectedTarget'].set('ALL');

    component['onSendJingle']();

    expect(wsMock.send).toHaveBeenCalledWith({
      type: 'play_sound',
      sound_id: 's1',
    });
  });

  // --- CA-18: Send button disabled when no jingle selected ---

  it('CA-18: canSend is false when no jingle is selected', () => {
    const component = createComponent();

    expect(component['canSend']()).toBe(false);
  });

  it('CA-18: canSend is true when a jingle is selected', () => {
    const component = createComponent();
    component['selectedId'].set('s1');

    expect(component['canSend']()).toBe(true);
  });

  // --- CA-19: SOUND_NOT_FOUND error shows toast ---

  it('CA-19: shows toast on SOUND_NOT_FOUND error', () => {
    const component = createComponent();

    messagesSubject.next({ type: 'error', code: 'SOUND_NOT_FOUND' } as any);

    expect(component['toastMessage']()).toBe('Jingle introuvable sur le serveur');
  });

  // --- onSendJingle does nothing when no id selected ---

  it('does not send when selectedId is null', () => {
    const component = createComponent();
    component['selectedId'].set(null);

    component['onSendJingle']();

    expect(wsMock.send).not.toHaveBeenCalled();
  });

  // --- Error loading sounds ---

  it('shows toast when loading sounds fails', () => {
    soundServiceMock = {
      getAll: jest.fn().mockReturnValue(throwError(() => new Error('Network error'))),
    };

    messagesSubject = new Subject<InboundMessage>();
    wsMock = {
      send: jest.fn(),
      messages$: messagesSubject,
      isConnected: jest.fn().mockReturnValue(true),
      isReconnecting: jest.fn().mockReturnValue(false),
    };

    gsStub = {
      connectedBuzzers: jest.fn().mockReturnValue([]) as any,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SoundPanelComponent,
        { provide: WebSocketService, useValue: wsMock },
        { provide: SoundService, useValue: soundServiceMock },
        { provide: GameStateService, useValue: gsStub },
      ],
    });

    const component = TestBed.inject(SoundPanelComponent);
    expect(component['toastMessage']()).toBe('Erreur lors du chargement des jingles');
  });
});
