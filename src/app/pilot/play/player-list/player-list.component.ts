import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-player-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-list.component.html',
  styles: [],
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

  protected readonly lastCorrectAnswer = computed(() => {
    const results = this.gs.state().questionResults;
    if (results.length === 0) return null;
    return results[results.length - 1].correct_answer;
  });
}
