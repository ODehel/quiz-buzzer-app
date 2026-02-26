import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../services/api';
import { WebsocketService } from '../../services/websocket';
import { GameService } from '../../services/game';
import { Question } from '../../models/question.model';

interface AnswerDetail {
  buzzerID: string;
  playerName: string;
  answer: number;
  isCorrect: boolean;
  points: number;
  responseTime: number;
  receivedAt: number;
}

interface BuzzerPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-game-play',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './game-play.html',
  styleUrl: './game-play.css'
})
export class GamePlayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private websocketService = inject(WebsocketService);
  private gameService = inject(GameService);
  private subscription = new Subscription();
  private timerSubscription: Subscription | null = null;
  timerPaused = false;

  // Signals
  gameId = signal('');
  currentQuestion = signal<Question | null>(null);
  questionIndex = signal(0);
  totalQuestions = signal(0);
  timeRemaining = signal(0);
  maxTime = signal(30);
  gameStatus = signal<'waiting' | 'question' | 'results' | 'ranking' | 'ended'>('waiting');
  showCorrectAnswer = signal(false);
  showBuzzModal = signal(false);
  buzzWinner = signal<{ buzzerID: string; playerName: string; responseTime: number } | null>(null);
  excludedPlayers = signal<string[]>([]);
  isBuzzerQuestion = computed(() => this.currentQuestion()?.type === 'buzzer');

  answerDetails = signal<AnswerDetail[]>([]);
  answerCounts = signal<number[]>([0, 0, 0, 0]);

  // Drag & drop
  private buzzerPositions: Map<string, BuzzerPosition> = new Map();
  private draggingBuzzerId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Signals dérivés
  ranking = this.gameService.ranking;
  buzzerCount = this.gameService.buzzerCount;
  buzzers = this.gameService.buzzers;

  answersReceived = computed(() => this.answerDetails().length);
  allAnswered = computed(() => this.answersReceived() >= this.buzzerCount());

  timePercentage = computed(() => {
    if (this.maxTime() === 0) return 100;
    return Math.round((this.timeRemaining() / this.maxTime()) * 100);
  });

  timeBarColor = computed(() => {
    const pct = this.timePercentage();
    if (pct > 50) return 'bg-success';
    if (pct > 20) return 'bg-warning';
    return 'bg-danger';
  });

  maxAnswerCount = computed(() => {
    const counts = this.answerCounts();
    return Math.max(...counts, 1);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.gameId.set(id);
    }

    const game = this.gameService.currentGame();
    if (game) {
      this.totalQuestions.set(game.totalQuestions);
      this.questionIndex.set(game.currentQuestionIndex);
    } else {
      this.router.navigate(['/lobby']);
      return;
    }

    this.initializeBuzzerPositions();

    this.subscription.add(
      this.websocketService.messages$.subscribe(message => {
        this.handleWebSocketMessage(message);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.stopTimer();
  }

  // ═══════════════════════════════════════
  // DRAG & DROP DES BUZZERS
  // ═══════════════════════════════════════

  private initializeBuzzerPositions(): void {
    const allBuzzers = this.buzzers();
    const count = allBuzzers.length;
    if (count === 0) return;

    // Dimensions écran et table
    const screenW = 1920;
    const screenH = 1080;
    const tableW = screenW * 0.54;
    const tableH = screenH * 0.68;
    const tableLeft = (screenW - tableW) / 2;
    const tableTop = (screenH - tableH) / 2;
    const buzzerW = 150;
    const buzzerH = 120;
    const margin = 16;
    const barH = 50; // barre de contrôle en bas

    // Répartir uniformément autour des 4 côtés de la table
    // On distribue : haut, droite, bas, gauche — round-robin
    const sides: { x: number; y: number }[][] = [[], [], [], []]; // top, right, bottom, left

    for (let i = 0; i < count; i++) {
      sides[i % 4].push({ x: 0, y: 0 });
    }

    let idx = 0;
    // TOP
    for (let s = 0; s < sides[0].length; s++) {
      const n = sides[0].length;
      const x = tableLeft + ((s + 1) / (n + 1)) * tableW - buzzerW / 2;
      const y = tableTop - buzzerH - margin;
      this.buzzerPositions.set(allBuzzers[idx].id, {
        x: this.clamp(x, 10, screenW - buzzerW - 10),
        y: this.clamp(y, 10, screenH - buzzerH - barH - 10)
      });
      idx++;
    }
    // RIGHT
    for (let s = 0; s < sides[1].length; s++) {
      const n = sides[1].length;
      const x = tableLeft + tableW + margin;
      const y = tableTop + ((s + 1) / (n + 1)) * tableH - buzzerH / 2;
      this.buzzerPositions.set(allBuzzers[idx].id, {
        x: this.clamp(x, 10, screenW - buzzerW - 10),
        y: this.clamp(y, 10, screenH - buzzerH - barH - 10)
      });
      idx++;
    }
    // BOTTOM
    for (let s = 0; s < sides[2].length; s++) {
      const n = sides[2].length;
      const x = tableLeft + ((s + 1) / (n + 1)) * tableW - buzzerW / 2;
      const y = tableTop + tableH + margin;
      this.buzzerPositions.set(allBuzzers[idx].id, {
        x: this.clamp(x, 10, screenW - buzzerW - 10),
        y: this.clamp(y, 10, screenH - buzzerH - barH - 10)
      });
      idx++;
    }
    // LEFT
    for (let s = 0; s < sides[3].length; s++) {
      const n = sides[3].length;
      const x = tableLeft - buzzerW - margin;
      const y = tableTop + ((s + 1) / (n + 1)) * tableH - buzzerH / 2;
      this.buzzerPositions.set(allBuzzers[idx].id, {
        x: this.clamp(x, 10, screenW - buzzerW - 10),
        y: this.clamp(y, 10, screenH - buzzerH - barH - 10)
      });
      idx++;
    }
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  getBuzzerPosition(buzzerId: string): BuzzerPosition {
    return this.buzzerPositions.get(buzzerId) || { x: 100, y: 100 };
  }

  onBuzzerMouseDown(event: MouseEvent, buzzerId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.draggingBuzzerId = buzzerId;
    const pos = this.getBuzzerPosition(buzzerId);
    this.dragOffsetX = event.clientX - pos.x;
    this.dragOffsetY = event.clientY - pos.y;
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.draggingBuzzerId) return;

    const newX = this.clamp(event.clientX - this.dragOffsetX, 0, 1920 - 150);
    const newY = this.clamp(event.clientY - this.dragOffsetY, 0, 1080 - 130);

    this.buzzerPositions.set(this.draggingBuzzerId, { x: newX, y: newY });
  }

  onMouseUp(): void {
    this.draggingBuzzerId = null;
  }

  // ═══════════════════════════════════════
  // HELPERS BUZZER
  // ═══════════════════════════════════════

  getBuzzerScore(buzzerId: string): number {
    const player = this.ranking().find(r => r.buzzerID === buzzerId);
    return player?.score ?? 0;
  }

  getPlayerAnswerIndex(buzzerId: string): number {
    const detail = this.answerDetails().find(d => d.buzzerID === buzzerId);
    return detail?.answer ?? -1;
  }

  getPlayerResponseTime(buzzerId: string): number {
    const detail = this.answerDetails().find(d => d.buzzerID === buzzerId);
    return detail?.responseTime ?? 0;
  }

  isPlayerCorrect(buzzerId: string): boolean {
    const detail = this.answerDetails().find(d => d.buzzerID === buzzerId);
    return detail?.isCorrect ?? false;
  }

  // ═══════════════════════════════════════
  // LOGIQUE DE JEU (inchangée)
  // ═══════════════════════════════════════

  sendQuestion(): void {
    this.gameStatus.set('question');
    this.showCorrectAnswer.set(false);
    this.answerDetails.set([]);
    this.answerCounts.set([0, 0, 0, 0]);

    this.apiService.getCurrentQuestion(this.gameId()).subscribe({
      next: (question) => {
        this.currentQuestion.set(question);

        const duration = question.type === 'mcq'
          ? (this.gameService.currentGame()?.settings?.mcqDuration || 30000) / 1000
          : (this.gameService.currentGame()?.settings?.buzzerDuration || 10000) / 1000;
        this.maxTime.set(duration);
        this.timeRemaining.set(duration);

        this.websocketService.send('QUESTION_SEND', {
          gameId: this.gameId(),
          questionId: question.id
        });

        this.startTimer();
      },
      error: (err) => console.error('Error getting question:', err)
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerPaused = false;

    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.timerPaused) return;

      this.timeRemaining.update(t => {
        if (t <= 1) {
          this.stopTimer();
          this.onTimeUp();
          return 0;
        }
        return t - 1;
      });
    });
  }

  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
    this.timerPaused = false;
  }

  private pauseTimer(): void {
    this.timerPaused = true;
  }

  private resumeTimer(): void {
    this.timerPaused = false;
    if (this.timeRemaining() <= 0) {
      this.stopTimer();
      this.onTimeUp();
    }
  }

  showResults(): void {
    this.stopTimer();
    this.showBuzzModal.set(false);
    this.buzzWinner.set(null);
    this.gameStatus.set('results');
    this.showCorrectAnswer.set(true);
  }

  showRanking(): void {
    this.apiService.getRanking(this.gameId()).subscribe({
      next: (ranking) => {
        this.gameService.setRanking(ranking);
        this.gameStatus.set('ranking');
      },
      error: (err) => console.error('Error getting ranking:', err)
    });
  }

  nextQuestion(): void {
    this.apiService.nextQuestion(this.gameId()).subscribe({
      next: (result) => {
        if (result.status === 'ended') {
          this.gameStatus.set('ended');
          this.showFinalRanking();
        } else {
          this.questionIndex.update(i => i + 1);
          this.gameStatus.set('waiting');
        }
      },
      error: (err) => console.error('Error next question:', err)
    });
  }

  private showFinalRanking(): void {
    this.apiService.getRanking(this.gameId()).subscribe({
      next: (ranking) => this.gameService.setRanking(ranking)
    });
  }

  endGame(): void {
    this.router.navigate(['/results', this.gameId()]);
  }

  getPlayerName(buzzerID: string): string {
    const buzzer = this.buzzers().find(b => b.id === buzzerID);
    return buzzer?.name || buzzerID;
  }

  getAnswerBarWidth(answerIndex: number): number {
    const total = this.answersReceived();
    if (total === 0) return 0;
    return (this.answerCounts()[answerIndex] / total) * 100;
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'ANSWER_RECEIVED': {
        const detail: AnswerDetail = {
          buzzerID: message.payload.buzzerID,
          playerName: this.getPlayerName(message.payload.buzzerID),
          answer: message.payload.answer,
          isCorrect: message.payload.isCorrect,
          points: message.payload.points,
          responseTime: message.payload.responseTime,
          receivedAt: Date.now(),
        };

        this.answerDetails.update(details => [...details, detail]);

        const answerIndex = typeof message.payload.answer === 'number'
          ? message.payload.answer : 0;
        if (answerIndex >= 0 && answerIndex < 4) {
          this.answerCounts.update(counts => {
            const newCounts = [...counts];
            newCounts[answerIndex]++;
            return newCounts;
          });
        }
        break;
      }

      case 'BUZZ_WINNER': {
        this.buzzWinner.set({
          buzzerID: message.payload.buzzerID,
          playerName: message.payload.playerName,
          responseTime: message.payload.responseTime,
        });
        this.showBuzzModal.set(true);
        this.pauseTimer();
        break;
      }

      case 'BUZZ_VALIDATED': {
        this.showBuzzModal.set(false);
        this.stopTimer();

        const detail: AnswerDetail = {
          buzzerID: message.payload.buzzerID,
          playerName: this.getPlayerName(message.payload.buzzerID),
          answer: 0,
          isCorrect: true,
          points: message.payload.points,
          responseTime: message.payload.responseTime,
          receivedAt: Date.now(),
        };
        this.answerDetails.update(details => [...details, detail]);

        this.gameStatus.set('results');
        break;
      }

      case 'BUZZ_REOPENED': {
        this.showBuzzModal.set(false);
        this.buzzWinner.set(null);
        this.excludedPlayers.set(message.payload.excludedPlayers);

        if (this.timeRemaining() > 0) {
          this.resumeTimer();
        } else {
          this.gameStatus.set('results');
          this.showCorrectAnswer.set(true);
        }
        break;
      }

      case 'QUESTION_SENT':
        console.log(`[Game] Question sent to ${message.payload.sentTo} buzzers`);
        break;
    }
  }

  confirmBuzzCorrect(): void {
    const winner = this.buzzWinner();
    if (!winner) return;

    this.stopTimer();

    this.websocketService.send('BUZZ_CORRECT', {
      gameId: this.gameId(),
      questionId: this.currentQuestion()?.id,
      buzzerID: winner.buzzerID,
    });
  }

  reopenBuzzer(): void {
    const winner = this.buzzWinner();
    if (!winner) return;

    this.websocketService.send('BUZZ_REOPEN', {
      gameId: this.gameId(),
      questionId: this.currentQuestion()?.id,
      buzzerID: winner.buzzerID,
    });
  }

  private onTimeUp(): void {
    if (this.isBuzzerQuestion()) {
      if (this.showBuzzModal()) {
        // Modale ouverte — le maître de jeu peut encore valider
      } else {
        this.gameStatus.set('results');
        this.showCorrectAnswer.set(true);
      }
    } else {
      this.showCorrectAnswer.set(true);
    }
  }

  hasPlayerAnswered(buzzerID: string): boolean {
    return this.answerDetails().some(d => d.buzzerID === buzzerID);
  }
}