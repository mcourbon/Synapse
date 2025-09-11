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

// Algorithme optimisé selon la courbe de l'oubli d'Ebbinghaus
export class SpacedRepetitionSystem {
  private static readonly INITIAL_EASE_FACTOR = 2.5;
  private static readonly MIN_EASE_FACTOR = 1.3;
  private static readonly MAX_EASE_FACTOR = 3.0;
  private static readonly MAX_INTERVAL = 60; // Maximum 2 mois

  // Séquences optimales basées sur la recherche cognitive
  private static readonly LEARNING_INTERVALS = [1, 3]; // 1 jour puis 3 jours pour l'apprentissage initial
  private static readonly GRADUATION_INTERVAL = 7; // 7 jours pour la "graduation"

  static calculateNextReview(
    currentStats: Partial<CardStats>,
    response: ReviewResponse
  ): CardStats {
    const stats: CardStats = {
      interval: currentStats.interval || 0,
      repetitions: currentStats.repetitions || 0,
      easeFactor: currentStats.easeFactor || this.INITIAL_EASE_FACTOR,
    };

    const now = new Date();
    let newInterval: number;
    let newRepetitions: number;
    let newEaseFactor: number = stats.easeFactor;

    switch (response) {
      case 'hard': // Échec - recommencer l'apprentissage
        newInterval = 0; // Révision immédiate (quelques minutes)
        newRepetitions = 0; // Reset complet
        newEaseFactor = Math.max(
          stats.easeFactor - 0.2,
          this.MIN_EASE_FACTOR
        );
        break;

      case 'medium': // Hésitant - progression prudente
        newEaseFactor = Math.max(
          stats.easeFactor - 0.15,
          this.MIN_EASE_FACTOR
        );
        
        if (stats.repetitions === 0) {
          // Première réussite après échec : 1 jour
          newInterval = this.LEARNING_INTERVALS[0];
          newRepetitions = 1;
        } else if (stats.repetitions === 1) {
          // Deuxième réussite : 3 jours (consolidation précoce)
          newInterval = this.LEARNING_INTERVALS[1];
          newRepetitions = 2;
        } else if (stats.repetitions === 2) {
          // Graduation prudente : 7 jours
          newInterval = this.GRADUATION_INTERVAL;
          newRepetitions = 3;
        } else {
          // Phase de révision : progression modérée (85% du facteur normal)
          newInterval = Math.round(stats.interval * newEaseFactor * 0.85);
          newRepetitions = stats.repetitions + 1;
        }
        break;

      case 'easy': // Maîtrisé - progression optimale
        newEaseFactor = Math.min(
          stats.easeFactor + 0.1,
          this.MAX_EASE_FACTOR
        );

        if (stats.repetitions === 0) {
          // Première réussite : 1 jour (consolidation initiale rapide)
          newInterval = this.LEARNING_INTERVALS[0];
          newRepetitions = 1;
        } else if (stats.repetitions === 1) {
          // Deuxième réussite : 4 jours (optimal selon Ebbinghaus)
          newInterval = 4;
          newRepetitions = 2;
        } else if (stats.repetitions === 2) {
          // Graduation : 10 jours (consolidation à long terme)
          newInterval = 10;
          newRepetitions = 3;
        } else {
          // Phase mature : progression exponentielle modifiée
          // Formule basée sur la courbe de rétention optimale (90% de rétention)
          const baseMultiplier = Math.min(newEaseFactor, 2.8);
          
          // Facteur de décroissance pour éviter des intervalles trop longs trop vite
          const maturityFactor = Math.min(1 + (stats.repetitions - 3) * 0.05, 1.3);
          
          newInterval = Math.round(stats.interval * baseMultiplier * maturityFactor);
          newRepetitions = stats.repetitions + 1;
        }
        break;
    }

    // Appliquer la limite maximale (sauf pour 'hard' qui doit rester à 0)
    if (response !== 'hard') {
      newInterval = Math.min(newInterval, this.MAX_INTERVAL);
      
      // Protection contre les intervalles trop courts en phase mature
      if (newRepetitions > 3 && newInterval < 7) {
        newInterval = 7;
      }
    }

    // Calculer la date de révision
    const nextReview = new Date(now);
    if (response === 'hard') {
      // Pour 'hard' : quelques minutes d'attente pour éviter la frustration
      nextReview.setMinutes(now.getMinutes() + 5);
    } else {
      nextReview.setDate(now.getDate() + newInterval);
      
      // Ajouter un peu de randomisation (±10%) pour éviter les "piles" de révisions
      const randomVariation = Math.floor((Math.random() - 0.5) * 0.2 * newInterval * 24 * 60); // en minutes
      nextReview.setMinutes(nextReview.getMinutes() + randomVariation);
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

  // Messages d'encouragement optimisés selon la phase d'apprentissage
  static getResponseMessage(response: ReviewResponse, interval: number, repetitions: number = 0): string {
    switch (response) {
      case 'hard':
        return `Cette carte nécessite plus de travail. Elle reviendra dans quelques minutes pour consolider l'apprentissage.`;
      
      case 'medium':
        if (repetitions <= 2) {
          return `Bien ! Cette carte est en cours d'apprentissage. Prochaine révision dans ${this.formatInterval(interval)}.`;
        } else {
          return `Correct, mais avec hésitation. La carte reviendra dans ${this.formatInterval(interval)} pour renforcer la mémorisation.`;
        }
      
      case 'easy':
        if (repetitions === 1) {
          return `Excellent ! Première maîtrise confirmée. Révision dans ${this.formatInterval(interval)} pour la consolidation.`;
        } else if (repetitions === 2) {
          return `Parfait ! La carte entre en phase de rétention à long terme. Prochaine révision dans ${this.formatInterval(interval)}.`;
        } else if (repetitions <= 5) {
          return `Maîtrisé ! Espacement optimal appliqué selon la courbe de l'oubli. Révision dans ${this.formatInterval(interval)}.`;
        } else {
          return `Expert ! Cette connaissance est solidement ancrée. Révision dans ${this.formatInterval(interval)}.`;
        }
      
      default:
        const days = interval === 1 ? '1 jour' : `${interval} jours`;
        return `Cette carte reviendra dans ${days}.`;
    }
  }

  // Statut de maîtrise plus précis
  static getCardMastery(repetitions: number, easeFactor: number): 'nouveau' | 'apprentissage' | 'consolidation' | 'révision' | 'maîtrisé' {
    if (repetitions === 0) return 'nouveau';
    if (repetitions < 3) return 'apprentissage';
    if (repetitions < 6) return 'consolidation';
    if (easeFactor > 2.3) return 'maîtrisé';
    return 'révision';
  }

  // Vérifie si une carte est en mode "hard" (révision immédiate)
  static isImmediateReview(interval: number): boolean {
    return interval === 0;
  }

  // Obtient les cartes en révision immédiate
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

  // Formatage d'intervalle amélioré
  private static formatInterval(days: number): string {
    if (days === 0) return 'quelques minutes';
    if (days === 1) return '1 jour';
    if (days < 7) return `${days} jours`;
    if (days < 14) return `${Math.round(days / 7)} semaine${Math.round(days / 7) > 1 ? 's' : ''}`;
    if (days < 30) return `${Math.round(days / 7)} semaines`;
    if (days < 60) return `${Math.round(days / 30)} mois`;
    return `2 mois`;
  }
}

// Fonction utilitaire pour formater les intervalles (version publique)
export function formatInterval(days: number): string {
  if (days === 0) return 'Maintenant';
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
        message: SpacedRepetitionSystem.getResponseMessage(response, newStats.interval, newStats.repetitions),
        stats: newStats,
        isImmediateReview: response === 'hard' // Indique si c'est une révision immédiate
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