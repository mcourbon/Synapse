// utils/fiche.ts
// Une "fiche" est une carte sans verso : tout le contenu est sur le recto, une info
// par ligne. En révision, seule la première ligne (le titre) est visible au départ ;
// chaque tap dévoile la ligne suivante, l'utilisateur essayant de s'en souvenir avant
// (lecture active). Pas de colonne dédiée en base : back === '' suffit à la repérer,
// ce qui évite une migration et reste compatible avec le mode invité (lib/localDb.ts).
import { Card } from '../types/database';

export const CARD_TEXT_MAX_LENGTH = 300;
export const FICHE_MAX_LENGTH = 1000;

export function isFiche(card: Pick<Card, 'back'> | null | undefined): boolean {
  return !!card && !card.back?.trim();
}

/** Lignes non vides de la fiche, dans l'ordre — la première sert de titre. */
export function ficheSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/** Texte court affiché pour une carte (tinycard d'accueil, listes) : le titre pour une fiche. */
export function cardTitle(card: Pick<Card, 'front' | 'back'>): string {
  if (!isFiche(card)) return card.front;
  return ficheSteps(card.front)[0] ?? card.front;
}
