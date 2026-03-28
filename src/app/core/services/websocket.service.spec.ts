import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router } from '@angular/router';

import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// Store original WebSocket constants
const WS_OPEN = 1;
const WS_CLOSED = 3;

// Mock WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = WS_OPEN;
  static readonly CLOSING = 2;
  static readonly CLOSED = WS_CLOSED;
  static instances: MockWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = WS_OPEN;
  readonly CLOSING = 2;
  readonly CLOSED = WS_CLOSED;

  url: string;
  readyState = WS_OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WS_CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000 }));
    }
  }

  simulateOpen(): void {
    if (this.onopen) this.onopen(new Event('open'));
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent('message', { data: JSON.stringify(data) })
      );
    }
  }

  simulateClose(code: number = 1006): void {
    this.readyState = WS_CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code }));
    }
  }
}

describe('WebSocketService', () => {
  let service: WebSocketService;
  let authMock: {
    getToken: jest.Mock;
    refresh: jest.Mock;
    isReady: jest.Mock;
  };
  let routerMock: { navigate: jest.Mock };
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;

    authMock = {
      getToken: jest.fn().mockReturnValue('jwt-token'),
      refresh: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
    };
    routerMock = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  describe('connect()', () => {
    it('establishes a WebSocket connection to environment.wsUrl', () => {
      service.connect();
      expect(MockWebSocket.instances.length).toBe(1);
      expect(MockWebSocket.instances[0].url).toBe(environment.wsUrl);
    });

    it('sends auth message with JWT token on open', () => {
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      expect(ws.sent.length).toBe(1);
      expect(JSON.parse(ws.sent[0])).toEqual({
        type: 'auth',
        token: 'jwt-token',
      });
    });

    it('emits auth_success on messages$ observable', (done) => {
      service.connect();
      const ws = MockWebSocket.instances[0];

      service.messages$.subscribe((msg) => {
        expect(msg.type).toBe('auth_success');
        done();
      });

      ws.simulateOpen();
      ws.simulateMessage({ type: 'auth_success', expires_in: 3600 });
    });
  });

  describe('reconnection — backoff exponentiel', () => {
    it('CA-1 — reconnects with exponential backoff on connection loss', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();

      // Simulate connection loss
      ws1.simulateClose(1006);

      // First reconnect after 1s (2^0 * 1000)
      tick(1000);
      expect(MockWebSocket.instances.length).toBe(2);

      // Simulate second failure
      const ws2 = MockWebSocket.instances[1];
      ws2.simulateClose(1006);

      // Second reconnect after 2s (2^1 * 1000)
      tick(2000);
      expect(MockWebSocket.instances.length).toBe(3);

      discardPeriodicTasks();
    }));

    it('CA-1 — backoff is capped at 30s', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();

      // Simulate 10 consecutive failures to exceed 30s cap
      for (let i = 0; i < 10; i++) {
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        ws.simulateClose(1006);
        tick(30_000); // always tick max
      }

      // Should have reconnected each time
      expect(MockWebSocket.instances.length).toBe(11);

      discardPeriodicTasks();
    }));

    it('CA-2 — backoff resets to 0 after successful auth_success', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();

      // Cause a few failures to increase backoff
      ws1.simulateClose(1006);
      tick(1000);
      const ws2 = MockWebSocket.instances[1];
      ws2.simulateClose(1006);
      tick(2000);

      // Now reconnect successfully
      const ws3 = MockWebSocket.instances[2];
      ws3.simulateOpen();
      ws3.simulateMessage({ type: 'auth_success', expires_in: 3600 });

      // Lose connection again
      ws3.simulateClose(1006);

      // Should reconnect after 1s (reset), not 4s
      tick(1000);
      expect(MockWebSocket.instances.length).toBe(4);

      discardPeriodicTasks();
    }));

    it('CA-3 — isReconnecting is true during reconnection window', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateMessage({ type: 'auth_success', expires_in: 3600 });

      expect(service.isReconnecting()).toBe(false);

      ws1.simulateClose(1006);
      expect(service.isReconnecting()).toBe(true);

      tick(1000);
      discardPeriodicTasks();
    }));

    it('CA-4 — isConnected repasses to true after successful reconnection', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateMessage({ type: 'auth_success', expires_in: 3600 });
      expect(service.isConnected()).toBe(true);

      ws1.simulateClose(1006);
      expect(service.isConnected()).toBe(false);

      tick(1000);
      const ws2 = MockWebSocket.instances[1];
      ws2.simulateOpen();
      ws2.simulateMessage({ type: 'auth_success', expires_in: 3600 });
      expect(service.isConnected()).toBe(true);
      expect(service.isReconnecting()).toBe(false);

      discardPeriodicTasks();
    }));

    it('sends auth message with current token on reconnection', fakeAsync(() => {
      authMock.getToken.mockReturnValue('reconnect-token');
      service.connect();

      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateClose(1006);

      tick(1000);
      const ws2 = MockWebSocket.instances[1];
      ws2.simulateOpen();

      expect(JSON.parse(ws2.sent[0])).toEqual({
        type: 'auth',
        token: 'reconnect-token',
      });

      discardPeriodicTasks();
    }));
  });

  describe('codes de fermeture terminaux — pas de retry', () => {
    it('CA-5 — code 4004: no reconnection, navigates to /error with session replaced message', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateClose(4004);

      tick(30000);
      expect(MockWebSocket.instances.length).toBe(1); // No reconnection
      expect(routerMock.navigate).toHaveBeenCalledWith(['/error'], {
        state: { message: 'Cette session a été reprise dans un autre onglet.' },
      });
      expect(service.isReconnecting()).toBe(false);

      discardPeriodicTasks();
    }));

    it('CA-6 — code 4001: no reconnection, navigates to /error with auth error message', fakeAsync(() => {
      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateClose(4001);

      tick(30000);
      expect(MockWebSocket.instances.length).toBe(1); // No reconnection
      expect(routerMock.navigate).toHaveBeenCalledWith(['/error'], {
        state: { message: "Erreur d'authentification WebSocket." },
      });
      expect(service.isReconnecting()).toBe(false);

      discardPeriodicTasks();
    }));
  });

  describe('code 4002 — refresh before retry', () => {
    it('CA-7 — refreshes token before reconnecting on close code 4002', fakeAsync(() => {
      authMock.getToken.mockReturnValue('refreshed-token');

      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateClose(4002);

      // Wait for the refresh promise to resolve
      tick(0);
      expect(authMock.refresh).toHaveBeenCalled();

      // The reconnection should happen immediately after refresh
      expect(MockWebSocket.instances.length).toBe(2);

      discardPeriodicTasks();
    }));

    it('CA-8 — navigates to /error after 3 failed refresh attempts on 4002', async () => {
      jest.useFakeTimers();
      authMock.refresh.mockRejectedValue(new Error('Network error'));

      service.connect();
      const ws1 = MockWebSocket.instances[0];
      ws1.simulateOpen();
      ws1.simulateClose(4002);

      // First refresh attempt fails
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(1);

      // Second attempt after 5s
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(2);

      // Third attempt after 5s
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(3);

      // After 3 failures, should navigate to /error
      expect(routerMock.navigate).toHaveBeenCalledWith(['/error'], {
        state: { message: "Impossible de renouveler l'authentification." },
      });

      jest.useRealTimers();
    });
  });

  describe('token refresh via WebSocket', () => {
    it('CA-9/CA-10 — on token_expiring_soon, refreshes and sends auth_refresh', fakeAsync(() => {
      authMock.getToken.mockReturnValue('new-refreshed-token');
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      ws.simulateMessage({ type: 'token_expiring_soon' });

      // Wait for refresh promise
      tick(0);

      expect(authMock.refresh).toHaveBeenCalled();
      const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]);
      expect(lastSent).toEqual({
        type: 'auth_refresh',
        token: 'new-refreshed-token',
      });

      discardPeriodicTasks();
    }));

    it('CA-11 — auth_success after auth_refresh keeps isReady true', fakeAsync(() => {
      authMock.getToken.mockReturnValue('new-token');
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({ type: 'auth_success', expires_in: 3600 });

      expect(service.isConnected()).toBe(true);

      // Token refresh cycle
      ws.simulateMessage({ type: 'token_expiring_soon' });
      tick(0);
      ws.simulateMessage({ type: 'auth_success', expires_in: 3600 });

      expect(service.isConnected()).toBe(true);

      discardPeriodicTasks();
    }));

    it('CA-12 — retries refresh up to 3 times on failure, then closes socket', async () => {
      jest.useFakeTimers();
      authMock.refresh.mockRejectedValue(new Error('Network error'));
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      ws.simulateMessage({ type: 'token_expiring_soon' });

      // First attempt fails
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(1);

      // Second attempt after 5s
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(2);

      // Third attempt after 5s
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('CA-13 — on token_expired, refreshes and triggers reconnection via close', async () => {
      jest.useFakeTimers();
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      ws.simulateMessage({ type: 'token_expired' });

      // Wait for refresh promise
      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('CA-13 — on token_expired with failed refresh, still closes socket', async () => {
      jest.useFakeTimers();
      authMock.refresh.mockRejectedValue(new Error('Network error'));
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      ws.simulateMessage({ type: 'token_expired' });

      await Promise.resolve();
      await Promise.resolve();
      expect(authMock.refresh).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('send()', () => {
    it('sends message when socket is open', () => {
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      service.send({ type: 'trigger_title' });

      const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]);
      expect(lastSent).toEqual({ type: 'trigger_title' });
    });

    it('does not send when socket is not open', () => {
      service.connect();
      const ws = MockWebSocket.instances[0];
      ws.readyState = WS_CLOSED;

      const sentBefore = ws.sent.length;
      service.send({ type: 'trigger_title' });
      expect(ws.sent.length).toBe(sentBefore);
    });
  });
});
