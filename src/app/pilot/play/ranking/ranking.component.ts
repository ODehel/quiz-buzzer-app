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
    <div class="modal-overlay" data-testid="ranking-overlay">
      <div class="ranking-panel" style="width:100%;max-width:680px;max-height:90vh;overflow:hidden;animation:overlay-in .25s ease-out">

        <!-- Header -->
        <div class="ranking-header">
          <div class="flex-col gap-1">
            <div class="ranking-title">
              Classement interm&eacute;diaire
              <span class="ranking-badge">Mi-parcours</span>
            </div>
            <div class="ranking-sub">
              Apr&egrave;s Q{{ lastQuestionIndex() }}
              @if (gs.state().totalQuestions) {
                / {{ gs.state().totalQuestions }}
              }
            </div>
          </div>
          <button
            class="btn-close"
            (click)="close.emit()"
            data-testid="btn-close-ranking"
          >
            &#10005;
          </button>
        </div>

        <!-- Body -->
        <div class="ranking-body">

          <!-- Podium (top 3) -->
          @if (gs.state().ranking && gs.state().ranking!.length >= 3) {
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:12px;padding:0 10px">
              <!-- 2nd place -->
              @if (podiumEntry(1); as entry) {
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1">
                  <div class="podium-avatar silver">{{ entry.participant_name.charAt(0).toUpperCase() }}</div>
                  <div class="font-display font-bold" style="font-size:13px;text-align:center">{{ entry.participant_name }}</div>
                  <div class="font-display font-extrabold text-silver" style="font-size:15px;text-align:center">{{ entry.cumulative_score }}</div>
                  <div style="width:100%;height:60px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,rgba(148,163,184,.15),rgba(148,163,184,.05));border:1px solid rgba(148,163,184,.25);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--silver);font-family:var(--font-display);animation:podium-rise .4s .2s ease-out both">2</div>
                </div>
              }
              <!-- 1st place -->
              @if (podiumEntry(0); as entry) {
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1">
                  <div class="podium-avatar gold">{{ entry.participant_name.charAt(0).toUpperCase() }}</div>
                  <div class="font-display font-bold" style="font-size:13px;text-align:center">{{ entry.participant_name }}</div>
                  <div class="font-display font-extrabold text-gold" style="font-size:15px;text-align:center">{{ entry.cumulative_score }}</div>
                  <div style="width:100%;height:80px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,rgba(251,191,36,.2),rgba(251,191,36,.08));border:1px solid rgba(251,191,36,.3);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--gold);font-family:var(--font-display);animation:podium-rise .4s .1s ease-out both">1</div>
                </div>
              }
              <!-- 3rd place -->
              @if (podiumEntry(2); as entry) {
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1">
                  <div class="podium-avatar bronze">{{ entry.participant_name.charAt(0).toUpperCase() }}</div>
                  <div class="font-display font-bold" style="font-size:13px;text-align:center">{{ entry.participant_name }}</div>
                  <div class="font-display font-extrabold text-bronze" style="font-size:15px;text-align:center">{{ entry.cumulative_score }}</div>
                  <div style="width:100%;height:44px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,rgba(194,132,90,.15),rgba(194,132,90,.05));border:1px solid rgba(194,132,90,.25);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--bronze);font-family:var(--font-display);animation:podium-rise .4s .3s ease-out both">3</div>
                </div>
              }
            </div>
          }

          <!-- Full ranking table -->
          <div class="flex-col gap-2">
            <div class="ranking-table-title">Classement complet</div>
            @for (entry of gs.state().ranking; track entry.rank) {
              <div class="ranking-row"
                [class.rank-1]="entry.rank === 1"
                style="grid-template-columns:32px 1fr 100px 100px;gap:8px"
                data-testid="ranking-row">
                <div class="rk-rank"
                  [class.gold]="entry.rank === 1"
                  [class.silver]="entry.rank === 2"
                  [class.bronze]="entry.rank === 3"
                  [class.other]="entry.rank > 3">
                  {{ entry.rank }}
                </div>
                <div class="rk-name">{{ entry.participant_name }}</div>
                <div>
                  <div class="rk-score">{{ entry.cumulative_score }}</div>
                  <div class="rk-score-label">points</div>
                </div>
                <div>
                  <div class="rk-time"><strong>{{ formatTime(entry.total_time_ms) }}</strong></div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="ranking-footer">
          <div class="ranking-context">
            <div class="context-dot"></div>
            La partie est en cours derri&egrave;re cet overlay
          </div>
          <button
            class="btn-dismiss"
            (click)="close.emit()"
            data-testid="btn-close-ranking"
          >
            Reprendre la partie
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [],
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

  protected lastQuestionIndex(): number {
    return (this.gs.state().questionIndex ?? 0) + 1;
  }

  protected podiumEntry(rank0: number): any {
    const ranking = this.gs.state().ranking;
    if (!ranking || ranking.length <= rank0) return null;
    return ranking[rank0];
  }
}
