// utils/fsrs.ts
// FSRS (Free Spaced Repetition Scheduler) — modélise la mémoire via deux variables par
// carte : la stabilité S (nombre de jours pour que la probabilité de rappel retombe à la
// "rétention cible") et la difficulté D (1 à 10, plus haut = plus dur). Remplace le SM-2
// utilisé jusqu'ici (utils/spacedRepetition.ts, supprimé).
//
// Poids par défaut publiés par le projet FSRS (FSRS-4.5), pensés pour être ensuite
// réoptimisés sur l'historique réel de révisions d'un utilisateur une fois qu'il y en a
// assez (des centaines de révisions) — hors de portée ici, donc on reste sur les valeurs
// par défaut génériques.
const W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
  0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
];

const REQUESTED_RETENTION = 0.9; // rétention cible : 90%
const DECAY_FACTOR = 9; // cf. formule de rétrécissement ci-dessous

export type ReviewResponse = 'hard' | 'medium' | 'easy';

export interface FsrsCardState {
  stability: number | null;
  difficulty: number | null;
  lastReviewed?: string | Date | null;
  lapses?: number;
}

export interface FsrsResult {
  stability: number;
  difficulty: number;
  interval: number; // jours
  lapses: number;
  lastReviewed: Date;
  nextReview: Date;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Les 3 boutons de l'app correspondent à 3 des 4 notes FSRS (on saute "Hard"=2) :
// Difficile -> Again (1), Moyen -> Good (3), Facile -> Easy (4).
function responseToGrade(response: ReviewResponse): 1 | 3 | 4 {
  if (response === 'hard') return 1;
  if (response === 'easy') return 4;
  return 3;
}

function initialStability(grade: number): number {
  return W[grade - 1];
}

function initialDifficulty(grade: number): number {
  return clamp(W[4] - (grade - 3) * W[5], 1, 10);
}

function nextDifficulty(difficulty: number, grade: number): number {
  const shifted = difficulty - W[6] * (grade - 3);
  const easyD0 = clamp(W[4] - W[5], 1, 10); // D0(Easy)
  return clamp(W[7] * easyD0 + (1 - W[7]) * shifted, 1, 10);
}

/** Probabilité de rappel après `elapsedDays` jours, pour une stabilité donnée. */
export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + elapsedDays / (DECAY_FACTOR * stability), -1);
}

function nextStabilityOnSuccess(difficulty: number, stability: number, r: number, grade: number): number {
  const hardPenalty = grade === 2 ? W[15] : 1;
  const easyBonus = grade === 4 ? W[16] : 1;
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    Math.pow(stability, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1);
  return stability * (1 + growth * hardPenalty * easyBonus);
}

function nextStabilityOnLapse(difficulty: number, stability: number, r: number): number {
  return W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
}

function intervalForStability(stability: number): number {
  return Math.max(1, Math.round(DECAY_FACTOR * stability * (1 / REQUESTED_RETENTION - 1)));
}

export function scheduleNext(current: FsrsCardState, response: ReviewResponse, now: Date = new Date()): FsrsResult {
  const grade = responseToGrade(response);
  const currentLapses = current.lapses || 0;

  let newDifficulty: number;
  let newStability: number;

  if (current.stability == null || current.difficulty == null) {
    // Carte jamais évaluée sous FSRS (nouvelle, ou pas encore révisée depuis la migration).
    newDifficulty = initialDifficulty(grade);
    newStability = initialStability(grade);
  } else {
    const elapsedDays = current.lastReviewed
      ? Math.max(0, (now.getTime() - new Date(current.lastReviewed).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const r = retrievability(elapsedDays, current.stability);
    newDifficulty = nextDifficulty(current.difficulty, grade);
    newStability =
      grade === 1
        ? nextStabilityOnLapse(current.difficulty, current.stability, r)
        : nextStabilityOnSuccess(current.difficulty, current.stability, r, grade);
  }

  const nextReview = new Date(now);

  if (response === 'hard') {
    // Comme avant : on rejoue la carte presque tout de suite plutôt que d'appliquer
    // l'intervalle long terme calculé par FSRS (qui ne s'applique qu'après un rappel réussi).
    nextReview.setMinutes(now.getMinutes() + 5);
    return {
      stability: newStability,
      difficulty: newDifficulty,
      interval: 0,
      lapses: currentLapses + 1,
      lastReviewed: now,
      nextReview,
    };
  }

  const interval = intervalForStability(newStability);
  nextReview.setDate(nextReview.getDate() + interval);
  // ±5% de flou pour éviter que les cartes reviennent toutes le même jour.
  const fuzzMinutes = Math.floor((Math.random() - 0.5) * 0.1 * interval * 24 * 60);
  nextReview.setMinutes(nextReview.getMinutes() + fuzzMinutes);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    interval,
    lapses: currentLapses,
    lastReviewed: now,
    nextReview,
  };
}

export function isDue(nextReview: Date | string | null | undefined): boolean {
  if (!nextReview) return true;
  const reviewDate = typeof nextReview === 'string' ? new Date(nextReview) : nextReview;
  const today = new Date();
  const reviewDateOnly = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return reviewDateOnly <= todayDateOnly;
}

export type CardMastery = 'nouveau' | 'apprentissage' | 'consolidation' | 'révision' | 'maîtrisé' | 'difficile';

export function getCardMastery(
  stability: number | null | undefined,
  difficulty: number | null | undefined,
  lapses: number = 0
): CardMastery {
  if (lapses >= 3) return 'difficile';
  if (stability == null) return 'nouveau';
  if (stability < 7) return 'apprentissage';
  if (stability < 21) return 'consolidation';
  // Stabilité élevée : "maîtrisé" si l'algorithme la juge aussi facile (D bas),
  // sinon "révision" — solide sur le papier mais encore perçue comme difficile.
  return (difficulty ?? 5) <= 6 ? 'maîtrisé' : 'révision';
}

/** Facilité affichée à l'utilisateur : 0% (très dur) à 100% (très facile), dérivée de D (1-10). */
export function difficultyToEasePercent(difficulty: number | null | undefined): number | null {
  if (difficulty == null) return null;
  return Math.round((10 - difficulty) * 100 / 9);
}
