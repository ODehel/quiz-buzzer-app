import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { ErrorComponent } from './error.component';

describe('ErrorComponent', () => {
  it('CA-23 — displays the message from query params', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) =>
                  key === 'message' ? 'Test error message' : null,
              },
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ErrorComponent);
    const component = fixture.componentInstance;

    expect(component.message).toBe('Test error message');
  });

  it('CA-23 — displays default message when no query param', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ErrorComponent);
    const component = fixture.componentInstance;

    expect(component.message).toBe('Une erreur inattendue est survenue.');
  });
});
