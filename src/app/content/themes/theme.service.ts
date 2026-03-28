import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { Theme } from '../../core/models/question.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Theme[]> {
    return this.http.get<Theme[]>(
      `${environment.serverUrl}/api/v1/themes`
    );
  }
}
