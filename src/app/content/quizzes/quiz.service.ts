import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import type { PagedResponse } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);

  getCount(): Observable<number> {
    return this.http
      .get<PagedResponse<unknown>>(
        `${environment.serverUrl}/api/v1/quizzes`,
        { params: { page: 1, limit: 1 } }
      )
      .pipe(map((res) => res.total));
  }
}
