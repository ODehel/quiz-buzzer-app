import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { WebsocketService } from '../../services/websocket';
import { GameService } from '../../services/game';
import { Question } from '../../models/question.model';

@Component({
  selector: 'app-game-config',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './game-config.html',
  styleUrl: './game-config.css'
})
export class GameConfigComponent implements OnInit {
  private apiService = inject(ApiService);
  private websocketService = inject(WebsocketService);
  private gameService = inject(GameService);
  private router = inject(Router);

  // Signals
  questions = signal<Question[]>([]);
  selectedQuestionIds = signal<Set<number>>(new Set());
  isLoading = signal(false);
  errorMessage = signal('');

  // Configuration de la partie
  gameName = signal('Partie du soir');
  mcqDuration = signal(30);
  buzzerDuration = signal(10);

  // Signals dérivés
  buzzerCount = this.gameService.buzzerCount;
  buzzers = this.gameService.buzzers;
  selectedCount = computed(() => this.selectedQuestionIds().size);
  canStart = computed(() => this.selectedCount() > 0 && this.buzzerCount() > 0);

  ngOnInit(): void {
    // Vérifier qu'il y a des buzzers connectés
    if (this.buzzerCount() === 0) {
      this.errorMessage.set('Aucun buzzer connecté. Retournez au lobby.');
    }
    this.loadQuestions();
  }

  private getValidQuestionIds(questions: { id?: number }[]): Set<number> {
    return new Set<number>(questions.map(q => q.id).filter((id): id is number => id !== undefined));
  }

  loadQuestions(): void {
    this.isLoading.set(true);
    this.apiService.getQuestions().subscribe({
      next: (questions) => {
        this.questions.set(questions);
        // Sélectionner toutes les questions par défaut
        this.selectedQuestionIds.set(this.getValidQuestionIds(questions));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      }
    });
  }

  toggleQuestion(questionId: number | undefined): void {
    if (questionId === undefined) return;
    this.selectedQuestionIds.update(ids => {
      const newIds = new Set(ids);
      if (newIds.has(questionId)) {
        newIds.delete(questionId);
      } else {
        newIds.add(questionId);
      }
      return newIds;
    });
  }

  toggleAll(): void {
    if (this.selectedQuestionIds().size === this.questions().length) {
      this.selectedQuestionIds.set(new Set());
    } else {
      this.selectedQuestionIds.set(this.getValidQuestionIds(this.questions()));
    }
  }

  isSelected(questionId: number | undefined): boolean {
    if (questionId === undefined) return false;
    return this.selectedQuestionIds().has(questionId);
  }

  /**
   * Créer la partie, enregistrer les joueurs, démarrer et naviguer
   */
  async createAndStartGame(): Promise<void> {
    const selectedIds = Array.from(this.selectedQuestionIds());

    if (selectedIds.length === 0) {
      this.errorMessage.set('Sélectionnez au moins une question');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // 1. Créer la partie sur le serveur
      const game = await this.createGame(selectedIds);

      // 2. Enregistrer tous les buzzers connectés comme joueurs
      await this.registerPlayers(game.id);

      // 3. Démarrer la partie
      await this.startGame(game.id);

      // 4. Stocker la partie dans le service
      this.gameService.setCurrentGame({
        id: game.id,
        name: this.gameName(),
        status: 'started',
        questionIds: selectedIds,
        currentQuestionIndex: 0,
        totalQuestions: selectedIds.length,
        playerCount: this.buzzerCount(),
        settings: {
          mcqDuration: this.mcqDuration() * 1000,
          buzzerDuration: this.buzzerDuration() * 1000,
          showCorrectAnswer: true,
          showIntermediateRanking: true
        }
      });

      // 5. Notifier les buzzers que la partie commence
      this.websocketService.send('GAME_START', {
        gameId: game.id,
        name: this.gameName(),
        totalQuestions: selectedIds.length
      });

      // 6. Naviguer vers Game Play
      this.isLoading.set(false);
      this.router.navigate(['/game', game.id]);

    } catch (error: any) {
      this.errorMessage.set(error.message || 'Erreur lors de la création de la partie');
      this.isLoading.set(false);
    }
  }

  /**
   * Créer la partie sur le serveur (API REST)
   */
  private createGame(questionIds: number[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.apiService.createGame(
        this.gameName(),
        questionIds,
        {
          mcqDuration: this.mcqDuration() * 1000,
          buzzerDuration: this.buzzerDuration() * 1000
        }
      ).subscribe({
        next: (game) => resolve(game),
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Enregistrer tous les buzzers connectés comme joueurs
   */
  private async registerPlayers(gameId: string): Promise<void> {
    const buzzers = this.buzzers();

    for (const buzzer of buzzers) {
      await new Promise<void>((resolve, reject) => {
        this.apiService.registerPlayer(gameId, buzzer.id, buzzer.name).subscribe({
          next: () => resolve(),
          error: (err) => reject(err)
        });
      });
    }
  }

  /**
   * Démarrer la partie
   */
  private startGame(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.apiService.startGame(gameId).subscribe({
        next: () => resolve(),
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Retour au lobby
   */
  goBack(): void {
    this.router.navigate(['/lobby']);
  }
}