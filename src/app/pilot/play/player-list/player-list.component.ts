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
  template: `
    <div class="col-header">
      <span class="col-title">Joueurs</span>
      @if (gs.state().questionType === 'MCQ' && gs.state().status === 'QUESTION_OPEN') {
        <span class="text-muted" style="font-size:11px">
          <strong class="text-accent">{{ gs.state().playerAnswers.length }}</strong>
          / {{ gs.state().participants.length }} ont répondu
        </span>
      }
      @if (gs.status() === 'QUESTION_BUZZED') {
        <span style="font-size:11px;color:var(--purple);font-weight:600">1 buzzeur actif</span>
      }
    </div>

    <div style="flex:1;overflow-y:auto" data-testid="player-list">
      @for (player of players(); track player.order) {
        <!-- QUESTION_CLOSED: result rows -->
        @if (gs.status() === 'QUESTION_CLOSED' && player.answer) {
          <div class="result-row" data-testid="player-item">
            <span class="player-num">{{ player.order }}</span>
            <span class="player-name truncate">{{ player.name }}</span>
            <span class="r-answer">
              {{ player.answer.choice }}
            </span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex-shrink:0;margin-left:auto">
              <span style="font-size:10px;color:var(--muted)">{{ (player.answer.response_time_ms / 1000).toFixed(1) }} s</span>
            </div>
          </div>
        }

        <!-- QUESTION_BUZZED: buzzer/blocked badges -->
        @else if (gs.status() === 'QUESTION_BUZZED') {
          <div class="player-row" data-testid="player-item"
            [style.background]="player.isBuzzer ? 'rgba(168,85,247,.06)' : ''">
            <div class="player-top">
              <span class="player-num" [style.color]="player.isBuzzer ? 'var(--purple)' : ''">{{ player.order }}</span>
              <span class="player-name" [style.font-weight]="player.isBuzzer ? '700' : ''">{{ player.name }}</span>
              @if (player.isBuzzer) {
                <div class="badge-buzzed" data-testid="player-badge">
                  <div style="width:5px;height:5px;border-radius:50%;background:var(--purple)"></div>
                  Buzzé
                </div>
              } @else if (player.isInvalidated) {
                <div class="badge-blocked" data-testid="player-badge">Invalidé</div>
              } @else {
                <div class="badge-blocked" data-testid="player-badge">Bloqué</div>
              }
            </div>
          </div>
        }

        <!-- Default: MCQ open / title states -->
        @else {
          <div class="player-row" data-testid="player-item">
            <div class="player-top">
              <span class="player-num">{{ player.order }}</span>
              <span class="player-name">{{ player.name }}</span>
              @if (player.answer) {
                <span class="answer-chip answered" data-testid="player-answer">
                  {{ player.answer.choice }}
                </span>
              } @else if (gs.status() === 'QUESTION_OPEN') {
                <span class="answer-chip pending">En attente...</span>
              }
            </div>
            @if (player.answer) {
              <div class="player-time">{{ (player.answer.response_time_ms / 1000).toFixed(1) }} s</div>
            } @else if (gs.status() === 'QUESTION_OPEN') {
              <div class="player-time" style="font-style:italic">&mdash;</div>
            }
          </div>
        }
      }
    </div>

    <!-- Answer counter (MCQ OPEN) -->
    @if (gs.state().questionType === 'MCQ' && gs.state().status === 'QUESTION_OPEN') {
      <div class="answer-counter" data-testid="answer-counter">
        <span class="counter-label" style="font-size:11px;color:var(--muted)">Réponses reçues</span>
        <span class="counter-val">
          <span class="n">{{ gs.state().playerAnswers.length }}</span>
          <span class="total"> / {{ gs.state().participants.length }}</span>
        </span>
      </div>
    }

    <!-- Result summary (QUESTION_CLOSED) -->
    @if (gs.status() === 'QUESTION_CLOSED' && lastCorrectAnswer()) {
      <div class="answer-counter" data-testid="result-summary">
        <span style="font-size:11px;color:var(--muted)">Bonne réponse : <strong class="text-green">{{ lastCorrectAnswer() }}</strong></span>
        @if (gs.state().timeLimit) {
          <span style="font-size:11px;color:var(--muted)">{{ gs.state().timeLimit }} s</span>
        }
      </div>
    }
  `,
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
