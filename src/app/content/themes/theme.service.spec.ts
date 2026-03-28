import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ThemeService } from './theme.service';
import type { Theme } from '../../core/models/question.models';

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('calls GET /api/v1/themes', () => {
    const mockThemes: Theme[] = [
      { id: 't1', name: 'Culture' },
      { id: 't2', name: 'Sport' },
    ];

    service.getAll().subscribe((themes) => {
      expect(themes).toEqual(mockThemes);
    });

    const req = httpMock.expectOne('/api/v1/themes');
    expect(req.request.method).toBe('GET');
    req.flush(mockThemes);
  });
});
