import { computeRemaining } from './timer.utils';

describe('computeRemaining', () => {
  it('CA-21 — retourne le temps restant correct', () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString(); // 10s ecoulees
    expect(computeRemaining(startedAt, 30)).toBeCloseTo(20, 0);
  });

  it('CA-22 — ne retourne jamais une valeur negative', () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString(); // 60s ecoulees
    expect(computeRemaining(startedAt, 30)).toBe(0);
  });

  it('CA-23 — est plafonne a timeLimit si horloge desynchronisee', () => {
    const startedAt = new Date(Date.now() + 5_000).toISOString(); // dans le futur
    expect(computeRemaining(startedAt, 30)).toBe(30);
  });

  it('CA-21 — retourne timeLimit quand started_at est maintenant', () => {
    const startedAt = new Date(Date.now()).toISOString();
    expect(computeRemaining(startedAt, 30)).toBeCloseTo(30, 0);
  });

  it('CA-21 — retourne 0 quand timeLimit vaut 0', () => {
    const startedAt = new Date(Date.now()).toISOString();
    expect(computeRemaining(startedAt, 0)).toBe(0);
  });
});
