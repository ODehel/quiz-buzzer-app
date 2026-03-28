import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  Output,
  EventEmitter,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../content/sounds/sound.service';
import type { Sound } from '../../../core/models/sound.models';
import type { OutboundMessage } from '../../../core/models/websocket.models';

@Component({
  selector: 'app-sound-panel',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sound-panel">
      <h3 class="sound-panel__title">Sons</h3>

      <section class="sound-panel__system">
        <h4>Sons système</h4>
        <div class="sound-panel__buttons">
          <button
            class="btn btn--sm btn--outline"
            (click)="onTriggerSystemSound('WAITING')"
            data-testid="btn-waiting"
          >
            Waiting
          </button>
          <button
            class="btn btn--sm btn--outline"
            (click)="onTriggerSystemSound('SUSPENSE')"
            data-testid="btn-suspense"
          >
            Suspense
          </button>
        </div>
      </section>

      <section class="sound-panel__jingle">
        <h4>Jingles</h4>

        <label class="field">
          <span class="field__label">Jingle</span>
          <select
            [ngModel]="selectedId()"
            (ngModelChange)="selectedId.set($event)"
            data-testid="select-jingle"
          >
            <option [ngValue]="null">-- Choisir --</option>
            @for (s of sounds(); track s.id) {
              <option [ngValue]="s.id">{{ s.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="field__label">Cible</span>
          <select
            [ngModel]="selectedTarget()"
            (ngModelChange)="selectedTarget.set($event)"
            data-testid="select-target"
          >
            <option value="ALL">Tous</option>
            @for (buzzer of gs.connectedBuzzers(); track buzzer) {
              <option [value]="buzzer">{{ buzzer }}</option>
            }
          </select>
        </label>

        <button
          class="btn btn--sm btn--primary"
          [disabled]="!canSend()"
          (click)="onSendJingle()"
          data-testid="btn-send-jingle"
        >
          Envoyer
        </button>
      </section>

      <section class="sound-panel__ranking">
        <button
          class="btn btn--sm btn--outline btn--ranking"
          (click)="triggerRanking.emit()"
          data-testid="btn-ranking"
        >
          Classement
        </button>
      </section>

      @if (toastMessage()) {
        <div class="toast toast--error" data-testid="toast">
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .sound-panel { padding: 12px; }
    .sound-panel__title { margin: 0 0 12px; font-size: 1rem; }
    .sound-panel__system { margin-bottom: 16px; }
    .sound-panel__system h4, .sound-panel__jingle h4 { margin: 0 0 8px; font-size: 0.85rem; color: #6c757d; }
    .sound-panel__buttons { display: flex; gap: 8px; }
    .sound-panel__ranking { margin-top: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .field__label { font-size: 0.75rem; color: #6c757d; }
    .field select { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.85rem; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .btn--sm { padding: 6px 12px; font-size: 0.8rem; }
    .btn--primary { background: #0d6efd; color: #fff; }
    .btn--primary:disabled { opacity: 0.5; cursor: default; }
    .btn--outline { background: #fff; border: 1px solid #ced4da; color: #495057; }
    .btn--outline:hover { background: #f8f9fa; }
    .btn--ranking { width: 100%; }
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .toast--error { background: #dc3545; color: #fff; }
  `],
})
export class SoundPanelComponent {
  protected readonly gs = inject(GameStateService);
  private readonly soundService = inject(SoundService);

  @Output() readonly triggerSystemSound = new EventEmitter<OutboundMessage>();
  @Output() readonly playSound = new EventEmitter<OutboundMessage>();
  @Output() readonly triggerRanking = new EventEmitter<void>();

  protected readonly sounds = signal<Sound[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedTarget = signal<string>('ALL');
  protected readonly canSend = computed(() => this.selectedId() !== null);

  protected readonly toastMessage = signal<string | null>(null);

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
