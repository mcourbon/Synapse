// utils/spacedRepetition.ts
import { useState } from 'react';

export interface CardStats {
  interval: number;        // Nombre de jours avant la prochaine révision
  repetitions: number;     // Nombre de fois correctement révisée
  easeFactor: number;      // Facteur de facilité (2.5 par défaut)
  lastReviewed?: Date;
  nextReview?: Date;
}

export type ReviewResponse = 'hard' | 'medium' | 'easy';

// Algorithme basé sur SM-2 simplifié avec 3 réponses
export class SpacedRepetitionSystem {
  private static readonly INITIAL_INTERVAL = 1;
  private static readonly INITIAL_EASE_FACTOR = 2.5;
  private static readonly MIN_EASE_FACTOR = 1.3;
  private static readonly MAX_EASE_FACTOR = 3.2;
  private static readonly MAX_INTERVAL = 60; // Maximum 2 mois (60 jours)

  static calculateNextReview(
    currentStats: Partial<CardStats>,
    response: ReviewResponse
  ): CardStats {
    const stats: CardStats = {
      interval: currentStats.interval || this.INITIAL_INTERVAL,
      repetitions: currentStats.repetitions || 0,
      easeFactor: currentStats.easeFactor || this.INITIAL_EASE_FACTOR,
    };

    const now = new Date();
    let newInterval: number;
    let newRepetitions: number;
    let newEaseFactor: number = stats.easeFactor;

    switch (response) {
      case 'hard': // Difficile - mauvaise réponse
        // 🔥 CORRECTION : TOUJOURS remettre à 0 pour révision immédiate
        newInterval = 0; // 0 = immédiatement disponible pour révision
        newRepetitions = 0; // Reset les répétitions (casse la win streak)
        newEaseFactor = Math.max(
          stats.easeFactor - 0.2,
          this.MIN_EASE_FACTOR
        );
        break;

      case 'medium': // Moyen - réponse correcte mais hésitante
        // 🔥 CORRECTION : Si on vient d'un "hard" (interval = 0), traiter comme nouveau départ
        if (stats.interval === 0 || stats.repetitions === 0) {
          newInterval = 2; // Dans 2 jours - comme un nouveau départ
        } else if (stats.repetitions === 1) {
          newInterval = 4; // Dans 4 jours
        } else {
          newInterval = Math.round(stats.interval * (stats.easeFactor * 0.85)); // Progression modérée
        }
        newRepetitions = stats.repetitions + 1;
        newEaseFactor = Math.max(
          stats.easeFactor - 0.05,
          this.MIN_EASE_FACTOR
        );
        break;

      case 'easy': // Facile - réponse parfaite
        // 🔥 CORRECTION : Si on vient d'un "hard" (interval = 0), traiter comme nouveau départ
        if (stats.interval === 0 || stats.repetitions === 0) {
          newInterval = 4; // Dans 4 jours - comme un nouveau départ
        } else if (stats.repetitions === 1) {
          newInterval = 8; // Dans 8 jours
        } else {
          newInterval = Math.round(stats.interval * (stats.easeFactor * 1.1)); // Progression rapide
        }
        newRepetitions = stats.repetitions + 1;
        newEaseFactor = Math.min(
          stats.easeFactor + 0.1,
          this.MAX_EASE_FACTOR
        );
        break;
    }

    // 🔥 CORRECTION : Ne pas appliquer la limite MAX_INTERVAL pour "hard"
    // car newInterval est déjà à 0 et doit le rester
    if (response !== 'hard') {
      newInterval = Math.min(newInterval, this.MAX_INTERVAL);
    }

    // Calculer la prochaine date de révision
    const nextReview = new Date(now);
    if (response === 'hard') {
      // Pour "hard", on garde la date actuelle (disponible immédiatement)
      // Mais on peut ajouter quelques minutes pour éviter la re-sélection immédiate
      nextReview.setMinutes(now.getMinutes() + 1);
    } else {
      nextReview.setDate(now.getDate() + newInterval);
    }

    return {
      interval: newInterval,
      repetitions: newRepetitions,
      easeFactor: newEaseFactor,
      lastReviewed: now,
      nextReview,
    };
  }

  // Détermine si une carte doit être révisée
  static isDue(nextReview: Date | string | null): boolean {
    if (!nextReview) return true;
    const reviewDate = typeof nextReview === 'string' ? new Date(nextReview) : nextReview;
    return reviewDate <= new Date();
  }

  // Calcule le nombre de cartes dues
  static getDueCount(cards: Array<{ next_review: string | null }>): number {
    return cards.filter(card => this.isDue(card.next_review)).length;
  }

  // Obtient le message d'encouragement
  static getResponseMessage(response: ReviewResponse, interval: number): string {
    switch (response) {
      case 'hard':
        return `Cette carte est encore difficile. Elle restera disponible pour révision immédiate. 🔄`;
      case 'medium':
        const daysMedium = interval === 1 ? '1 jour' : `${interval} jours`;
        return `Bien joué ! Cette carte reviendra dans ${daysMedium}.`;
      case 'easy':
        const daysEasy = interval === 1 ? '1 jour' : `${interval} jours`;
        return `Excellent ! Cette carte reviendra dans ${daysEasy}.`;
      default:
        const days = interval === 1 ? '1 jour' : `${interval} jours`;
        return `Cette carte reviendra dans ${days}.`;
    }
  }

  // Statistiques avancées
  static getCardMastery(repetitions: number, easeFactor: number): 'nouveau' | 'apprentissage' | 'révision' | 'maîtrisé' {
    if (repetitions === 0) return 'nouveau';
    if (repetitions < 3) return 'apprentissage';
    if (easeFactor < 2.2) return 'révision';
    return 'maîtrisé';
  }

  // 🆕 NOUVELLE FONCTION : Vérifie si une carte est en mode "hard" (révision immédiate)
  static isImmediateReview(interval: number): boolean {
    return interval === 0;
  }

  // 🆕 NOUVELLE FONCTION : Obtient les cartes en révision immédiate
  static getImmediateReviewCards(cards: Array<{ interval?: number; next_review: string | null }>): Array<any> {
    return cards.filter(card => {
      const interval = card.interval || 1;
      return this.isImmediateReview(interval) && this.isDue(card.next_review);
    });
  }

  // Getter pour la limite maximale (utile pour l'affichage)
  static getMaxInterval(): number {
    return this.MAX_INTERVAL;
  }
}

// Fonction utilitaire pour formater les intervalles
export function formatInterval(days: number): string {
  if (days === 0) return 'Maintenant'; // 🆕 Pour les révisions immédiates
  if (days === 1) return '1 jour';
  if (days < 30) return `${days} jours`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 mois' : `${months} mois`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? '1 an' : `${years} ans`;
}

// Types pour TypeScript
export interface EnhancedCard {
  id: string;
  front: string;
  back: string;
  interval?: number;
  repetitions?: number;
  ease_factor?: number;
  last_reviewed?: string;
  next_review?: string;
}

// Hook personnalisé pour la gestion des révisions
export function useSpacedRepetition() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processReview = async (
    cardId: string,
    response: ReviewResponse,
    currentStats: Partial<CardStats>,
    updateCallback: (cardId: string, stats: CardStats) => Promise<void>
  ) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const newStats = SpacedRepetitionSystem.calculateNextReview(currentStats, response);
      await updateCallback(cardId, newStats);
      
      return {
        success: true,
        message: SpacedRepetitionSystem.getResponseMessage(response, newStats.interval),
        stats: newStats,
        isImmediateReview: response === 'hard' // 🆕 Indique si c'est une révision immédiate
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de la sauvegarde',
        error
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return { processReview, isProcessing };
}