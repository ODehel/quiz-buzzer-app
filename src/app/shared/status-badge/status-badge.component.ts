import { Component, ChangeDetectionStrategy, Input, computed, signal } from '@angular/core';

import type { GameStatus } from '../../core/models/websocket.models';

interface BadgeConfig {
  label: string;
  cssClass: string;
}

const STATUS_MAP: Record<GameStatus, BadgeConfig> = {
  PENDING:          { label: 'En attente', cssClass: 'badge--amber' },
  OPEN:             { label: 'En cours',   cssClass: 'badge--blue' },
  QUESTION_TITLE:   { label: 'En cours',   cssClass: 'badge--blue' },
  QUESTION_OPEN:    { label: 'En cours',   cssClass: 'badge--blue' },
  QUESTION_BUZZED:  { label: 'En cours',   cssClass: 'badge--blue' },
  QUESTION_CLOSED:  { label: 'En cours',   cssClass: 'badge--blue' },
  COMPLETED:        { label: 'Terminée',   cssClass: 'badge--green' },
  IN_ERROR:         { label: 'Erreur',     cssClass: 'badge--red' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="config().cssClass">{{ config().label }}</span>
  `,
  styles: [`
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge--amber  { background: #fff3cd; color: #856404; }
    .badge--blue   { background: #cce5ff; color: #004085; }
    .badge--green  { background: #d4edda; color: #155724; }
    .badge--red    { background: #f8d7da; color: #721c24; }
  `],
})
export class StatusBadgeComponent {
  protected readonly _status = signal<GameStatus>('PENDING');

  @Input({ required: true })
  set status(value: GameStatus) {
    this._status.set(value);
  }

  protected readonly config = computed<BadgeConfig>(() => {
    return STATUS_MAP[this._status()] ?? { label: 'Inconnu', cssClass: '' };
  });
}
