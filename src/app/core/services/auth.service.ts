import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { TokenResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly _token = signal<string | null>(null);
  readonly isReady = signal(false);

  getToken(): string | null {
    return this._token();
  }

  async initialize(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(
          `${environment.serverUrl}/api/v1/token`,
          {
            username: environment.adminUsername,
            password: environment.adminPassword,
          }
        )
      );
      this._token.set(response.token);
      this.isReady.set(true);
    } catch {
      this.isReady.set(false);
      await this.router.navigate(['/error'], {
        queryParams: { message: 'Impossible de se connecter au serveur.' },
      });
    }
  }

  async refresh(): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(
        `${environment.serverUrl}/api/v1/token`,
        {
          username: environment.adminUsername,
          password: environment.adminPassword,
        }
      )
    );
    this._token.set(response.token);
  }
}
