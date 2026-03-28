/**
 * Calcule le temps restant en secondes depuis un horodatage de debut.
 * Toujours dans l'intervalle [0, timeLimit].
 */
export function computeRemaining(startedAt: string, timeLimit: number): number {
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, Math.min(timeLimit, timeLimit - elapsed));
}
