import { Injectable, inject, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, shareReplay } from 'rxjs';

import { AuthService } from './auth.service';
import type { InboundMessage, OutboundMessage } from '../models/websocket.models';
import { environment } from '../../../environments/environment';

const MAX_BACKOFF_MS = 30_000;
const NON_RETRYABLE_CLOSE_CODE = 4004;

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private socket: WebSocket | null = null;
  private readonly _messages$ = new Subject<InboundMessage>();

  readonly messages$: Observable<InboundMessage> = this._messages$.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly isConnected = signal(false);
  readonly isReconnecting = signal(false);

  connect(): void {
    this.zone.runOutsideAngular(() => {
      this.establishConnection(0);
    });
  }

  send(msg: OutboundMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private establishConnection(attempt: number): void {
    this.socket = new WebSocket(environment.wsUrl);

    this.socket.onopen = () => {
      attempt = 0;
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
        this.handleClose(event, attempt);
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
    }
    this._messages$.next(msg);
  }

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
        if (retryCount < 2) {
          setTimeout(() => this.refreshWithRetry(retryCount + 1), 5000);
        } else {
          this.socket?.close();
        }
      });
  }

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

  private handleClose(event: CloseEvent, attempt: number): void {
    this.socket = null;
    this.isConnected.set(false);

    if (event.code === NON_RETRYABLE_CLOSE_CODE) {
      this.router.navigate(['/error'], {
        queryParams: { message: 'Session remplacée par un autre onglet.' },
      });
      return;
    }

    if (event.code === 4002) {
      this.isReconnecting.set(true);
      this.auth
        .refresh()
        .then(() => {
          this.establishConnection(0);
        })
        .catch(() => {
          const delay = Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
          setTimeout(() => this.establishConnection(attempt + 1), delay);
        });
      return;
    }

    this.isReconnecting.set(true);
    const delay = Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
    setTimeout(() => this.establishConnection(attempt + 1), delay);
  }
}
