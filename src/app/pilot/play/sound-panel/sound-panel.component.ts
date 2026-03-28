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
    <div class="col-header">
      <span class="col-title">Sons &amp; Classement</span>
    </div>
    <div class="col-right-body">

      <!-- System sounds -->
      <div class="sound-section">
        <div class="sound-section-title">Sons syst&egrave;me</div>
        <div class="sound-btns">
          <button
            class="sound-btn"
            (click)="onTriggerSystemSound('WAITING')"
            data-testid="btn-waiting"
          >
            <span class="sound-icon">&#9200;</span>
            Compte &agrave; rebours
          </button>
          <button
            class="sound-btn"
            (click)="onTriggerSystemSound('SUSPENSE')"
            data-testid="btn-suspense"
          >
            <span class="sound-icon">&#127925;</span>
            Suspense
          </button>
        </div>
      </div>

      <!-- Jingles -->
      <div class="sound-section">
        <div class="sound-section-title">Jingles</div>

        <select
          class="jingle-select"
          [ngModel]="selectedId()"
          (ngModelChange)="selectedId.set($event)"
          data-testid="select-jingle"
          style="margin-bottom:6px"
        >
          <option [ngValue]="null">-- Choisir un jingle --</option>
          @for (s of sounds(); track s.id) {
            <option [ngValue]="s.id">{{ s.name }}</option>
          }
        </select>

        <select
          class="jingle-select"
          [ngModel]="selectedTarget()"
          (ngModelChange)="selectedTarget.set($event)"
          data-testid="select-target"
          style="margin-bottom:6px"
        >
          <option value="ALL">Tous</option>
          @for (buzzer of gs.connectedBuzzers(); track buzzer) {
            <option [value]="buzzer">{{ buzzer }}</option>
          }
        </select>

        <button
          class="btn-play-jingle"
          [disabled]="!canSend()"
          (click)="onSendJingle()"
          data-testid="btn-send-jingle"
        >
          &#9654; Jouer
        </button>
      </div>

      <!-- Ranking -->
      <div class="sound-section">
        <div class="sound-section-title">Classement</div>
        <button
          class="ranking-btn"
          (click)="triggerRanking.emit()"
          data-testid="btn-ranking"
        >
          Afficher le classement
        </button>
      </div>

      <!-- Cumulative scores -->
      <div class="col-header" style="margin-top:auto">
        <span class="col-title">Scores cumul&eacute;s</span>
      </div>
      <div class="scores-list">
        @for (p of sortedParticipants(); track p.name; let i = $index) {
          <div class="score-row">
            <span class="score-rank"
              [class.gold]="i === 0"
              [class.silver]="i === 1"
              [class.bronze]="i === 2">
              {{ i + 1 }}
            </span>
            <span class="score-name">{{ p.name }}</span>
            <span class="score-val">{{ p.cumulative_score }}</span>
          </div>
        }
      </div>

    </div>

    @if (toastMessage()) {
      <div class="toast-error" data-testid="toast">
        {{ toastMessage() }}
      </div>
    }
  `,
  styles: [],
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
