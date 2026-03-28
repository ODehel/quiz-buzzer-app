import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

import type { PagedResponse } from '../../core/models/api.models';
import type { Sound } from '../../core/models/sound.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.serverUrl}/api/v1/sounds`;

  getAll(params?: { page?: number; limit?: number }): Observable<PagedResponse<Sound>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PagedResponse<Sound>>(this.baseUrl, { params: httpParams });
  }

  async upload(name: string, file: File): Promise<Sound> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<Sound>(this.baseUrl, formData)
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`)
    );
  }
}
