import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';

import type { PagedResponse } from '../../core/models/api.models';
import type {
  Question,
  QuestionFilters,
  CreateQuestionDto,
  PatchQuestionDto,
  MediaUploadResponse,
} from '../../core/models/question.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QuestionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.serverUrl}/api/v1/questions`;

  getAll(filters: QuestionFilters): Observable<PagedResponse<Question>> {
    return this.http.get<PagedResponse<Question>>(this.baseUrl, {
      params: this.buildParams(filters),
    });
  }

  getById(id: string): Observable<Question> {
    return this.http.get<Question>(`${this.baseUrl}/${id}`);
  }

  getCount(): Observable<number> {
    return this.http
      .get<PagedResponse<unknown>>(this.baseUrl, {
        params: { page: 1, limit: 1 },
      })
      .pipe(map((res) => res.total));
  }

  async create(dto: CreateQuestionDto): Promise<Question> {
    return firstValueFrom(
      this.http.post<Question>(this.baseUrl, dto)
    );
  }

  async patch(id: string, changes: PatchQuestionDto): Promise<Question> {
    return firstValueFrom(
      this.http.patch<Question>(`${this.baseUrl}/${id}`, changes)
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`)
    );
  }

  async uploadMedia(
    id: string,
    type: 'image' | 'audio',
    file: File
  ): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<MediaUploadResponse>(
        `${this.baseUrl}/${id}/media`,
        formData
      )
    );
  }

  async deleteMedia(id: string, type: 'image' | 'audio'): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}/media/${type}`)
    );
  }

  private buildParams(filters: QuestionFilters): HttpParams {
    let params = new HttpParams()
      .set('page', filters.page.toString())
      .set('limit', filters.limit.toString());

    if (filters.theme_id) params = params.set('theme_id', filters.theme_id);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.level_min != null)
      params = params.set('level_min', filters.level_min.toString());
    if (filters.level_max != null)
      params = params.set('level_max', filters.level_max.toString());
    if (filters.points_min != null)
      params = params.set('points_min', filters.points_min.toString());
    if (filters.points_max != null)
      params = params.set('points_max', filters.points_max.toString());

    return params;
  }
}
