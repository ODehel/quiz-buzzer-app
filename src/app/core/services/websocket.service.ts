import { Injectable, inject, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, shareReplay } from 'rxjs';

import { AuthService } from './auth.service';
import type { InboundMessage, OutboundMessage } from '../models/websocket.models';
import { environment } from '../../../environments/environment';

const MAX_BACKOFF_MS = 30_000;
const REFRESH_RETRY_DELAY_MS = 5_000;
const MAX_REFRESH_RETRIES = 3;

const TERMINAL_CLOSE_CODES: Record<number, string> = {
  4004: 'Cette session a été reprise dans un autre onglet.',
  4001: "Erreur d'authentification WebSocket.",
};

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private socket: WebSocket | null = null;
  private readonly _messages$ = new Subject<InboundMessage>();
  private attempt = 0;

  readonly messages$: Observable<InboundMessage> = this._messages$.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly isConnected = signal(false);
  readonly isReconnecting = signal(false);

  connect(): void {
    this.zone.runOutsideAngular(() => {
      this.establishConnection();
    });
  }

  send(msg: OutboundMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private establishConnection(): void {
    this.socket = new WebSocket(environment.wsUrl);

    this.socket.onopen = () => {
      const token = this.auth.getToken();
      if (token) {
        this.socket!.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.zone.run(() => {
        const msg: InboundMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      });
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.zone.run(() => {
        this.handleClose(event.code);
      });
    };

    this.socket.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private handleMessage(msg: InboundMessage): void {
    if (msg.type === 'token_expiring_soon') {
      this.handleTokenExpiringSoon();
      return;
    }
    if (msg.type === 'token_expired') {
      this.handleTokenExpired();
      return;
    }
    if (msg.type === 'auth_success') {
      this.isConnected.set(true);
      this.isReconnecting.set(false);
      this.attempt = 0; // CA-2: reset backoff on successful auth
    }
    this._messages$.next(msg);
  }

  // CA-9/CA-10: Proactive refresh on token_expiring_soon
  private handleTokenExpiringSoon(): void {
    this.refreshWithRetry(0);
  }

  private refreshWithRetry(retryCount: number): void {
    this.auth
      .refresh()
      .then(() => {
        const token = this.auth.getToken();
        if (token) {
          this.send({ type: 'auth_refresh', token });
        }
      })
      .catch(() => {
        if (retryCount < MAX_REFRESH_RETRIES - 1) {
          // CA-12: retry up to 3 times with 5s delay
          setTimeout(
            () => this.refreshWithRetry(retryCount + 1),
            REFRESH_RETRY_DELAY_MS
          );
        } else {
          // CA-12: after 3 failures, close socket — backoff reconnection takes over
          this.socket?.close();
        }
      });
  }

  // CA-13: token_expired = same as close code 4002 — refresh then full reconnect
  private handleTokenExpired(): void {
    this.auth
      .refresh()
      .then(() => {
        this.socket?.close();
      })
      .catch(() => {
        this.socket?.close();
      });
  }

  private handleClose(code: number): void {
    this.socket = null;
    this.isConnected.set(false);

    // CA-5/CA-6: Terminal close codes — no retry
    const terminalMessage = TERMINAL_CLOSE_CODES[code];
    if (terminalMessage) {
      this.isReconnecting.set(false);
      this.router.navigate(['/error'], {
        state: { message: terminalMessage },
      });
      return;
    }

    this.isReconnecting.set(true);

    // CA-7: Token expired server-side — refresh before reconnecting
    if (code === 4002) {
      this.refreshThenReconnect(0);
      return;
    }

    // CA-1: All other codes — exponential backoff
    this.scheduleReconnect();
  }

  // CA-7/CA-8: Refresh with retry before reconnection
  private refreshThenReconnect(retryCount: number): void {
    this.auth
      .refresh()
      .then(() => {
        this.attempt = 0;
        this.establishConnection();
      })
      .catch(() => {
        if (retryCount < MAX_REFRESH_RETRIES - 1) {
          setTimeout(
            () => this.refreshThenReconnect(retryCount + 1),
            REFRESH_RETRY_DELAY_MS
          );
        } else {
          // CA-8: After 3 refresh failures, navigate to error
          this.isReconnecting.set(false);
          this.router.navigate(['/error'], {
            state: { message: "Impossible de renouveler l'authentification." },
          });
        }
      });
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.attempt), MAX_BACKOFF_MS);
    this.attempt++;
    setTimeout(() => this.establishConnection(), delay);
  }
}
