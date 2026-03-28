import {
  Component,
  ChangeDetectionStrategy,
  inject,
  Output,
  EventEmitter,
} from '@angular/core';

import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-ranking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ranking-overlay" data-testid="ranking-overlay">
      <div class="ranking-overlay__backdrop" (click)="close.emit()"></div>
      <div class="ranking-overlay__content">
        <div class="ranking-overlay__header">
          <h2>Classement intermédiaire</h2>
          <button
            class="ranking-overlay__close"
            (click)="close.emit()"
            data-testid="btn-close-ranking"
          >
            &times;
          </button>
        </div>
        <table class="ranking-table" data-testid="ranking-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>Joueur</th>
              <th>Score</th>
              <th>Temps total</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of gs.state().ranking; track entry.rank) {
              <tr data-testid="ranking-row">
                <td class="ranking-table__rank">{{ entry.rank }}</td>
                <td>{{ entry.participant_name }}</td>
                <td class="ranking-table__score">{{ entry.cumulative_score }}</td>
                <td class="ranking-table__time">{{ formatTime(entry.total_time_ms) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .ranking-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
    .ranking-overlay__backdrop { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); }
    .ranking-overlay__content { position: relative; background: #fff; border-radius: 12px; padding: 24px; min-width: 500px; max-width: 700px; max-height: 80vh; overflow-y: auto; }
    .ranking-overlay__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .ranking-overlay__header h2 { margin: 0; font-size: 1.25rem; }
    .ranking-overlay__close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6c757d; padding: 4px 8px; }
    .ranking-table { width: 100%; border-collapse: collapse; }
    .ranking-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #dee2e6; font-size: 0.85rem; color: #6c757d; }
    .ranking-table td { padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
    .ranking-table__rank { font-weight: 700; }
    .ranking-table__score { font-weight: 600; }
    .ranking-table__time { color: #6c757d; font-size: 0.9rem; }
  `],
})
export class RankingComponent {
  protected readonly gs = inject(GameStateService);

  @Output() readonly close = new EventEmitter<void>();

  protected formatTime(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
}
