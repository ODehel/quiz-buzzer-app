import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

import type { Game } from '../core/models/game.models';
import type { PagedResponse } from '../core/models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);

  getRecent(limit: number): Observable<Game[]> {
    return this.http
      .get<PagedResponse<Game>>(
        `${environment.serverUrl}/api/v1/games`,
        { params: { page: 1, limit } }
      )
      .pipe(map((res) => res.data));
  }

  getCount(): Observable<number> {
    return this.http
      .get<PagedResponse<Game>>(
        `${environment.serverUrl}/api/v1/games`,
        { params: { page: 1, limit: 1 } }
      )
      .pipe(map((res) => res.total));
  }
}
