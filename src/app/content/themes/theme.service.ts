import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

import type { Theme } from '../../core/models/question.models';
import type { PagedResponse } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.serverUrl}/api/v1/themes`;

  getAll(): Observable<PagedResponse<Theme>> {
    return this.http.get<PagedResponse<Theme>>(this.baseUrl, {
      params: { page: 1, limit: 100 },
    });
  }

  async create(name: string): Promise<Theme> {
    return firstValueFrom(
      this.http.post<Theme>(this.baseUrl, { name })
    );
  }

  async update(id: string, name: string): Promise<Theme> {
    return firstValueFrom(
      this.http.put<Theme>(`${this.baseUrl}/${id}`, { name })
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`)
    );
  }
}
