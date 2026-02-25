import { Injectable, signal, computed } from '@angular/core';
import { Game, Player } from '../models/game.model';
import { Buzzer } from '../models/buzzer.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  // Signals pour l'état du jeu (Angular 21 - stable)
  private _currentGame = signal<Game | null>(null);
  public currentGame = this._currentGame.asReadonly();

  private _buzzers = signal<Buzzer[]>([]);
  public buzzers = this._buzzers.asReadonly();

  private _ranking = signal<Player[]>([]);
  public ranking = this._ranking.asReadonly();

  // Signals dérivés
  public buzzerCount = computed(() => this._buzzers().length);
  public isGameActive = computed(() => this._currentGame()?.status === 'started');
  public hasEnoughPlayers = computed(() => this._buzzers().length >= 1);

  /**
   * Définir la partie actuelle
   */
  setCurrentGame(game: Game | null): void {
    this._currentGame.set(game);
  }

  /**
   * Mettre à jour la liste des buzzers
   */
  setBuzzers(buzzers: Buzzer[]): void {
    this._buzzers.set(buzzers);
  }

  /**
   * Ajouter un buzzer
   */
  addBuzzer(buzzer: Buzzer): void {
    this._buzzers.update(buzzers => [...buzzers, buzzer]);
  }

  /**
   * Supprimer un buzzer
   */
  removeBuzzer(buzzerID: string): void {
    this._buzzers.update(buzzers => buzzers.filter(b => b.id !== buzzerID));
  }

  /**
   * Mettre à jour le classement
   */
  setRanking(ranking: Player[]): void {
    this._ranking.set(ranking);
  }

  /**
   * Réinitialiser tout
   */
  reset(): void {
    this._currentGame.set(null);
    this._buzzers.set([]);
    this._ranking.set([]);
  }
}