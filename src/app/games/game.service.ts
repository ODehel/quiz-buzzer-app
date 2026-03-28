import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, firstValueFrom } from 'rxjs';

import type { Game, CreateGameDto, GameResults } from '../core/models/game.models';
import type { PagedResponse } from '../core/models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.serverUrl}/api/v1/games`;

  getAll(params?: { page?: number; limit?: number }): Observable<PagedResponse<Game>> {
    return this.http.get<PagedResponse<Game>>(this.baseUrl, {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
    });
  }

  getById(id: string): Observable<Game> {
    return this.http.get<Game>(`${this.baseUrl}/${id}`);
  }

  getActive(): Observable<Game | null> {
    return this.getAll({ page: 1, limit: 100 }).pipe(
      map((res) =>
        res.data.find(
          (g) => g.status !== 'COMPLETED' && g.status !== 'IN_ERROR'
        ) ?? null
      )
    );
  }

  getRecent(limit: number): Observable<Game[]> {
    return this.http
      .get<PagedResponse<Game>>(this.baseUrl, {
        params: { page: 1, limit },
      })
      .pipe(map((res) => res.data));
  }

  getCount(): Observable<number> {
    return this.http
      .get<PagedResponse<Game>>(this.baseUrl, {
        params: { page: 1, limit: 1 },
      })
      .pipe(map((res) => res.total));
  }

  getResults(id: string): Observable<GameResults> {
    return this.http.get<GameResults>(`${this.baseUrl}/${id}/results`);
  }

  async create(dto: CreateGameDto): Promise<Game> {
    return firstValueFrom(
      this.http.post<Game>(this.baseUrl, dto)
    );
  }

  async start(id: string): Promise<Game> {
    return firstValueFrom(
      this.http.post<Game>(`${this.baseUrl}/${id}/start`, {})
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`)
    );
  }
}
