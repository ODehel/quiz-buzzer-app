import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';

import { ErrorComponent } from './error.component';

describe('ErrorComponent', () => {
  function createComponent(opts: {
    navState?: Record<string, string>;
    queryParam?: string | null;
  }) {
    const currentNavigation = opts.navState
      ? { extras: { state: opts.navState } }
      : null;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { getCurrentNavigation: () => currentNavigation },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) =>
                  key === 'message' ? (opts.queryParam ?? null) : null,
              },
            },
          },
        },
      ],
    });

    return TestBed.createComponent(ErrorComponent);
  }

  it('CA-5/CA-6 — displays message from navigation state', () => {
    const fixture = createComponent({
      navState: { message: 'Cette session a été reprise dans un autre onglet.' },
    });
    expect(fixture.componentInstance.message()).toBe(
      'Cette session a été reprise dans un autre onglet.'
    );
  });

  it('displays message from query params as fallback', () => {
    const fixture = createComponent({ queryParam: 'Test error message' });
    expect(fixture.componentInstance.message()).toBe('Test error message');
  });

  it('CA-30 — displays default message when no message provided', () => {
    const fixture = createComponent({});
    expect(fixture.componentInstance.message()).toBe(
      "Une erreur inattendue s'est produite."
    );
  });

  it('navigation state takes precedence over query params', () => {
    const fixture = createComponent({
      navState: { message: 'From state' },
      queryParam: 'From query',
    });
    expect(fixture.componentInstance.message()).toBe('From state');
  });
});
