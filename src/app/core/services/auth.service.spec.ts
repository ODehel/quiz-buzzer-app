import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jest.Mocked<Router>;

  beforeEach(() => {
    routerSpy = { navigate: jest.fn().mockResolvedValue(true) } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: routerSpy }],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initialize()', () => {
    it('CA-1 — calls POST /api/v1/token with credentials from environment', async () => {
      const initPromise = service.initialize();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: environment.adminUsername,
        password: environment.adminPassword,
      });

      req.flush({ token: 'jwt-token-123', expires_in: 3600 });
      await initPromise;
    });

    it('CA-2 — on success, stores token and sets isReady to true', async () => {
      expect(service.isReady()).toBe(false);
      expect(service.getToken()).toBeNull();

      const initPromise = service.initialize();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      req.flush({ token: 'jwt-token-123', expires_in: 3600 });
      await initPromise;

      expect(service.getToken()).toBe('jwt-token-123');
      expect(service.isReady()).toBe(true);
    });

    it('CA-3 — on failure, navigates to /error with explicit message', async () => {
      const initPromise = service.initialize();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      req.error(new ProgressEvent('Network error'));
      await initPromise;

      expect(service.isReady()).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/error'], {
        queryParams: { message: 'Impossible de se connecter au serveur.' },
      });
    });

    it('CA-3 — on non-2xx response, navigates to /error', async () => {
      const initPromise = service.initialize();

      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      req.flush(
        { error: 'Unauthorized', message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' }
      );
      await initPromise;

      expect(service.isReady()).toBe(false);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/error'], {
        queryParams: { message: 'Impossible de se connecter au serveur.' },
      });
    });
  });

  describe('refresh()', () => {
    it('CA-12 — calls POST /api/v1/token and updates the stored token', async () => {
      // First, initialize to have a token
      const initPromise = service.initialize();
      httpMock
        .expectOne(`${environment.serverUrl}/api/v1/token`)
        .flush({ token: 'old-token', expires_in: 3600 });
      await initPromise;

      expect(service.getToken()).toBe('old-token');

      // Now refresh
      const refreshPromise = service.refresh();
      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'new-token', expires_in: 3600 });
      await refreshPromise;

      expect(service.getToken()).toBe('new-token');
    });

    it('CA-15 — throws on refresh failure so caller can handle retry', async () => {
      const refreshPromise = service.refresh();
      const req = httpMock.expectOne(
        `${environment.serverUrl}/api/v1/token`
      );
      req.error(new ProgressEvent('Network error'));

      await expect(refreshPromise).rejects.toBeTruthy();
    });
  });

  describe('getToken()', () => {
    it('CA-4 — returns null before initialization', () => {
      expect(service.getToken()).toBeNull();
    });

    it('CA-4 — returns the token after successful initialization', async () => {
      const initPromise = service.initialize();
      httpMock
        .expectOne(`${environment.serverUrl}/api/v1/token`)
        .flush({ token: 'test-token', expires_in: 3600 });
      await initPromise;

      expect(service.getToken()).toBe('test-token');
    });
  });
});
