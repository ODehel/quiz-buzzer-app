import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  readonly serverUrl = environment.serverUrl || 'localhost';
  readonly version = signal<string>('');

  fetchVersion(): void {
    this.http.get<{ version?: string }>('/api/v1/health').subscribe({
      next: (res) => this.version.set(res.version ? `v${res.version}` : ''),
      error: () => this.version.set(''),
    });
  }
}
