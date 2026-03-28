import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';

import type { PagedResponse } from '../../core/models/api.models';
import type {
  Quiz,
  QuizDetail,
  QuizFilters,
  CreateQuizDto,
  QuizCreateResponse,
} from '../../core/models/quiz.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.serverUrl}/api/v1/quizzes`;

  getAll(filters: QuizFilters): Observable<PagedResponse<Quiz>> {
    return this.http.get<PagedResponse<Quiz>>(this.baseUrl, {
      params: this.buildParams(filters),
    });
  }

  getById(id: string): Observable<QuizDetail> {
    return this.http.get<QuizDetail>(`${this.baseUrl}/${id}`);
  }

  getCount(): Observable<number> {
    return this.http
      .get<PagedResponse<unknown>>(this.baseUrl, {
        params: { page: 1, limit: 1 },
      })
      .pipe(map((res) => res.total));
  }

  async create(dto: CreateQuizDto): Promise<QuizCreateResponse> {
    return firstValueFrom(
      this.http.post<QuizCreateResponse>(this.baseUrl, dto)
    );
  }

  async update(id: string, dto: CreateQuizDto): Promise<QuizCreateResponse> {
    return firstValueFrom(
      this.http.put<QuizCreateResponse>(`${this.baseUrl}/${id}`, dto)
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`)
    );
  }

  private buildParams(filters: QuizFilters): HttpParams {
    let params = new HttpParams()
      .set('page', filters.page.toString())
      .set('limit', filters.limit.toString());

    if (filters.name) params = params.set('name', filters.name);

    return params;
  }
}
