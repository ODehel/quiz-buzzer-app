import {
  Component,
  ChangeDetectionStrategy,
  inject,
  output,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-ranking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ranking.component.html',
  styles: [],
})
export class RankingComponent {
  protected readonly gs = inject(GameStateService);

  readonly close = output<void>();

  protected formatTime(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  protected lastQuestionIndex(): number {
    return (this.gs.state().questionIndex ?? 0) + 1;
  }

  protected podiumEntry(rank0: number): any {
    const ranking = this.gs.state().ranking;
    if (!ranking || ranking.length <= rank0) return null;
    return ranking[rank0];
  }
}
