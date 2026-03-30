import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { GameStatus } from '../../core/models/websocket.models';

interface BadgeConfig {
  label: string;
  cssClass: string;
}

const STATUS_MAP: Record<GameStatus, BadgeConfig> = {
  PENDING:          { label: 'En attente', cssClass: 'badge badge-pending' },
  OPEN:             { label: 'En cours',   cssClass: 'badge badge-open' },
  QUESTION_TITLE:   { label: 'En cours',   cssClass: 'badge badge-open' },
  QUESTION_OPEN:    { label: 'En cours',   cssClass: 'badge badge-open' },
  QUESTION_BUZZED:  { label: 'En cours',   cssClass: 'badge badge-open' },
  QUESTION_CLOSED:  { label: 'En cours',   cssClass: 'badge badge-open' },
  COMPLETED:        { label: 'Terminée',   cssClass: 'badge badge-completed' },
  IN_ERROR:         { label: 'Erreur',     cssClass: 'badge badge-error' },
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="config().cssClass">{{ config().label }}</span>`,
  styles: [],
})
export class StatusBadgeComponent {
  readonly status = input.required<GameStatus>();

  protected readonly config = computed<BadgeConfig>(() => {
    return STATUS_MAP[this.status()] ?? { label: 'Inconnu', cssClass: 'badge' };
  });
}
