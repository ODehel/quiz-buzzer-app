import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-player-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="player-list" data-testid="player-list">
      <h3 class="player-list__title">Joueurs</h3>
      <ul class="player-list__items">
        @for (player of players(); track player.order) {
          <li
            class="player-list__item"
            [class.player-list__item--buzzed]="player.isBuzzer"
            [class.player-list__item--invalidated]="player.isInvalidated"
            data-testid="player-item"
          >
            <span class="player-list__order">{{ player.order }}</span>
            <span class="player-list__name">{{ player.name }}</span>

            @if (player.isBuzzer) {
              <span class="player-list__badge player-list__badge--buzzed" data-testid="player-badge">Buzzé</span>
            } @else if (gs.state().currentBuzzer && !player.isInvalidated) {
              <span class="player-list__badge player-list__badge--blocked" data-testid="player-badge">Bloqué</span>
            } @else if (player.isInvalidated) {
              <span class="player-list__badge player-list__badge--invalidated" data-testid="player-badge">Invalidé</span>
            }

            @if (player.answer) {
              <span class="player-list__answer" data-testid="player-answer">
                {{ player.answer.choice }} — {{ player.answer.response_time_ms }}ms
              </span>
            }

            <span class="player-list__score" data-testid="player-score">
              {{ player.cumulative_score }} pts
            </span>
          </li>
        }
      </ul>

      @if (gs.state().questionType === 'MCQ' && gs.state().status === 'QUESTION_OPEN') {
        <div class="player-list__counter" data-testid="answer-counter">
          {{ gs.state().playerAnswers.length }} / {{ gs.state().participants.length }} réponses
        </div>
      }
    </div>
  `,
  styles: [`
    .player-list { padding: 12px; }
    .player-list__title { margin: 0 0 12px; font-size: 1rem; }
    .player-list__items { list-style: none; padding: 0; margin: 0; }
    .player-list__item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 6px; font-size: 0.9rem; }
    .player-list__item--buzzed { border-color: #fd7e14; background: #fff3e0; }
    .player-list__item--invalidated { opacity: 0.5; }
    .player-list__order { font-weight: 600; min-width: 20px; color: #6c757d; }
    .player-list__name { flex: 1; }
    .player-list__badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .player-list__badge--buzzed { background: #fd7e14; color: #fff; }
    .player-list__badge--blocked { background: #6c757d; color: #fff; }
    .player-list__badge--invalidated { background: #dc3545; color: #fff; }
    .player-list__answer { font-size: 0.8rem; color: #495057; }
    .player-list__score { font-size: 0.8rem; color: #6c757d; margin-left: auto; }
    .player-list__counter { margin-top: 12px; font-size: 0.9rem; color: #495057; text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px; }
  `],
})
export class PlayerListComponent {
  protected readonly gs = inject(GameStateService);

  protected readonly players = computed(() => {
    const state = this.gs.state();
    return state.participants.map((p) => {
      const answer = state.playerAnswers.find(
        (a) => a.participant_order === p.order
      );
      return {
        order: p.order,
        name: p.name,
        cumulative_score: p.cumulative_score,
        answer: answer ?? null,
        isBuzzer: state.currentBuzzer === p.name,
        isInvalidated: state.invalidatedPlayers.includes(p.name),
      };
    });
  });
}
