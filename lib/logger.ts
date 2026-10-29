// lib/logger.ts
// Les logs de debug ont été retirés en masse (commit 6b480a2), ce qui rendait les
// échecs totalement silencieux. logError garde une trace des erreurs en dev
// (warning Metro / LogBox) sans réintroduire de bruit dans les builds de release.
export function logError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, error);
  }
}
