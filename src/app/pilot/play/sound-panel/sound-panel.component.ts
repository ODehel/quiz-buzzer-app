import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../content/sounds/sound.service';
import type { Sound } from '../../../core/models/sound.models';
import type { OutboundMessage } from '../../../core/models/websocket.models';

@Component({
  selector: 'app-sound-panel',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sound-panel.component.html',
  styles: [],
})
export class SoundPanelComponent {
  protected readonly gs = inject(GameStateService);
  private readonly soundService = inject(SoundService);

  readonly triggerSystemSound = output<OutboundMessage>();
  readonly playSound = output<OutboundMessage>();
  readonly triggerRanking = output<void>();

  protected readonly sounds = signal<Sound[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedTarget = signal<string>('ALL');
  protected readonly canSend = computed(() => this.selectedId() !== null);

  protected readonly toastMessage = signal<string | null>(null);

  protected readonly sortedParticipants = computed(() => {
    const participants = [...this.gs.state().participants];
    return participants.sort((a, b) => b.cumulative_score - a.cumulative_score);
  });

  constructor() {
    this.soundService
      .getAll({ limit: 100 })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (response) => this.sounds.set(response.data),
        error: () => this.showToast('Erreur lors du chargement des jingles'),
      });
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }

  protected onTriggerSystemSound(soundId: 'WAITING' | 'SUSPENSE'): void {
    this.triggerSystemSound.emit({ type: 'trigger_system_sound', sound_id: soundId });
  }

  protected onSendJingle(): void {
    const id = this.selectedId();
    if (!id) return;

    const target = this.selectedTarget();
    const msg: OutboundMessage = target === 'ALL'
      ? { type: 'play_sound', sound_id: id }
      : { type: 'play_sound', sound_id: id, targets: [target] };

    this.playSound.emit(msg);
  }
}
