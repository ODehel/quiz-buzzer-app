import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Question } from '../models/question.model';
import { Game } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.serverUrl + '/api';
  private http = inject(HttpClient);

  /**
   * Vérifier l'état du serveur
   */
  checkServerStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`).pipe(
      timeout(environment.httpTimeout),
      retry({
        count: environment.retryAttempts,
        delay: environment.retryDelay
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Récupérer toutes les questions
   */
  getQuestions(): Observable<Question[]> {
    return this.http.get<any[]>(`${this.apiUrl}/questions`).pipe(
      map(questions => questions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type?.toLowerCase() as 'mcq' | 'buzzer',
        options: q.answers,
        correctAnswer: q.correct_answer,
        expectedAnswer: q.expected_answer,
        timeLimit: q.time_limit,
        points: q.points,
        category: q.category,
        difficulty: q.difficulty,
      }))),
      catchError(this.handleError)
    );
  }

  /**
   * Créer une nouvelle question
   */
  createQuestion(question: Partial<Question>): Observable<any> {
    const payload = {
      text: question.text,
      type: question.type?.toUpperCase(),
      answers: question.options,
      correct_answer: question.correctAnswer,
      expected_answer: question.expectedAnswer,
      category: question.category,
      difficulty: question.difficulty,
      points: question.points,
    };
    return this.http.post(`${this.apiUrl}/questions`, payload).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Mettre à jour une question existante
   */
  updateQuestion(id: number, question: Partial<Question>): Observable<any> {
    const payload = {
      text: question.text,
      type: question.type?.toUpperCase(),
      answers: question.options,
      correct_answer: question.correctAnswer,
      expected_answer: question.expectedAnswer,
      category: question.category,
      difficulty: question.difficulty,
      points: question.points,
    };
    return this.http.put(`${this.apiUrl}/questions/${id}`, payload).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Créer une nouvelle partie
   */
  createGame(name: string, questionIds: number[], settings?: any): Observable<Game> {
    return this.http.post<Game>(`${this.apiUrl}/games`, {
      name,
      questionIds,
      settings
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtenir les détails d'une partie
   */
  getGame(gameId: string): Observable<Game> {
    return this.http.get<Game>(`${this.apiUrl}/games/${gameId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Démarrer une partie
   */
  startGame(gameId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/games/${gameId}/start`, {}).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtenir le classement
   */
  getRanking(gameId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/games/${gameId}/ranking`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Gestion des erreurs HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.status === 0) {
      errorMessage = 'Connexion refusée';
    } else if (error.status === 404) {
      errorMessage = 'Ressource non trouvée';
    } else if (error.status === 500) {
      errorMessage = 'Erreur serveur interne';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    }

    console.error('HTTP Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Supprimer une question
   */
  deleteQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/questions/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtenir la question actuelle d'une partie
   */
  getCurrentQuestion(gameId: string): Observable<Question> {
    return this.http.get<any>(`${this.apiUrl}/games/${gameId}/current-question`).pipe(
      map(q => ({
        id: q.id,
        text: q.text,
        type: q.type?.toLowerCase() as 'mcq' | 'buzzer',
        options: q.answers,
        correctAnswer: q.correct_answer,
        expectedAnswer: q.expected_answer,
        timeLimit: q.time_limit,
        points: q.points,
        category: q.category,
        difficulty: q.difficulty,
      })),
      catchError(this.handleError)
    );
  }

  /**
   * Passer à la question suivante
   */
  nextQuestion(gameId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/games/${gameId}/next-question`, {}).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtenir les statistiques d'une partie
   */
  getStats(gameId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/games/${gameId}/stats`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Enregistrer un joueur dans une partie
   */
  registerPlayer(gameId: string, buzzerID: string, playerName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/games/${gameId}/players`, {
      buzzerID,
      playerName
    }).pipe(
      catchError(this.handleError)
    );
  }
}