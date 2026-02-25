import { Injectable, signal } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, timer } from 'rxjs';
import { retryWhen, tap, delayWhen } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WebSocketMessage } from '../models/websocket-message.model';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket$: WebSocketSubject<WebSocketMessage> | null = null;
  private messagesSubject$ = new Subject<WebSocketMessage>();
  public messages$ = this.messagesSubject$.asObservable();

  // Signals pour l'état de connexion
  private _isConnected = signal(false);
  public isConnected = this._isConnected.asReadonly();

  private _sessionID = signal<string | null>(null);
  public sessionID = this._sessionID.asReadonly();

  /**
   * Se connecter au serveur WebSocket
   */
  connect(): void {
    if (this.socket$) {
      return;
    }

    this.socket$ = webSocket({
      url: environment.wsUrl,
      openObserver: {
        next: () => {
          console.log('[WebSocket] Connected');
          this._isConnected.set(true);
          this.sendAngularConnect();
        }
      },
      closeObserver: {
        next: () => {
          console.log('[WebSocket] Disconnected');
          this._isConnected.set(false);
          this.socket$ = null;
        }
      }
    });

    this.socket$
      .pipe(
        retryWhen(errors =>
          errors.pipe(
            tap(err => console.error('[WebSocket] Error:', err)),
            delayWhen(() => timer(2000))
          )
        )
      )
      .subscribe({
        next: (msg) => this.handleMessage(msg),
        error: (err) => console.error('[WebSocket] Error:', err)
      });
  }

  /**
   * Envoyer le message de connexion Angular
   */
  private sendAngularConnect(): void {
    this.send('ANGULAR_CONNECT', {
      version: '1.0.0',
      role: 'master'
    });
  }

  /**
   * Envoyer un message au serveur
   */
  send(type: string, payload: any): void {
    if (!this.socket$ || !this._isConnected()) {
      console.error('[WebSocket] Not connected');
      return;
    }

    const message: WebSocketMessage = {
      type,
      timestamp: Date.now(),
      sender: 'ANGULAR',
      payload
    };

    console.log('[WebSocket] Sending:', type, payload);
    this.socket$.next(message);
  }

  /**
   * Demander la liste des buzzers connectés au serveur
   */
  requestBuzzerList(): void {
    this.send('REQUEST_BUZZER_LIST', {});
  }

  /**
   * Gérer les messages reçus
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log('[WebSocket] Received:', message.type, message.payload);

    if (message.type === 'CONNECTED') {
      this._sessionID.set(message.payload.sessionID);
      console.log('[WebSocket] Session ID:', message.payload.sessionID);
    }

    this.messagesSubject$.next(message);
  }

  /**
   * Déconnecter
   */
  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
      this._isConnected.set(false);
    }
  }
}