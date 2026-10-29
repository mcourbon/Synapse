// utils/date.ts

/**
 * Jour calendaire LOCAL au format YYYY-MM-DD.
 * Ne pas utiliser toISOString() pour ça : il renvoie la date UTC, donc en France
 * une révision faite entre minuit et 1h/2h du matin tomberait sur la veille
 * (streak cassée ou jour d'étude manquant).
 */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Nombre de jours calendaires entre deux clés YYYY-MM-DD (b - a).
 * Les deux clés sont parsées de la même façon (minuit UTC), donc le résultat
 * est un entier exact, sans effet de changement d'heure.
 */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
