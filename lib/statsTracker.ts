// lib/statsTracker.ts
import { supabase } from './supabase';
import { logError } from './logger';
import { toLocalDateKey, daysBetweenKeys } from '../utils/date';

export interface ReviewStats {
  userId: string;
  response: 'hard' | 'medium' | 'easy';
  cardId: string;
  deckId: string;
  studyTime?: number; // temps en secondes
}

export class StatsTracker {
  /**
   * Met à jour les stats après chaque révision
   */
  static async trackReview(params: ReviewStats): Promise<void> {
    const { userId, response, studyTime = 0 } = params;

    try {
      // Vérifier si l'utilisateur a des stats
      const { data: existingStats, error: fetchError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        logError('StatsTracker.trackReview/fetch', fetchError);
        return;
      }

      const today = toLocalDateKey(); // Jour local YYYY-MM-DD (pas UTC, cf. utils/date.ts)

      if (!existingStats) {
        // Créer les stats si elles n'existent pas
        const { error: insertError } = await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            total_reviews: 1,
            correct_reviews: response !== 'hard' ? 1 : 0,
            hard_reviews: response === 'hard' ? 1 : 0,
            medium_reviews: response === 'medium' ? 1 : 0,
            easy_reviews: response === 'easy' ? 1 : 0,
            total_study_time: studyTime,
            current_streak: 1,
            longest_streak: 1,
            current_answer_streak: response !== 'hard' ? 1 : 0,
            best_answer_streak: response !== 'hard' ? 1 : 0,
            last_study_date: today,
            study_days: [today],
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          logError('StatsTracker.trackReview/insert', insertError);
        }
        return;
      }

      // Calculer la nouvelle streak
      const lastStudyDate = existingStats.last_study_date;
      let newStreak = existingStats.current_streak || 0;
      let newLongestStreak = existingStats.longest_streak || 0;

      if (lastStudyDate) {
        const diffDays = daysBetweenKeys(String(lastStudyDate).slice(0, 10), today);

        // <= 0 : même jour, ou dernière date "dans le futur" (anciennes dates
        // enregistrées en UTC, voyage vers un fuseau en retard) — on ne casse rien.
        if (diffDays <= 0) {
          // Même jour, pas de changement de streak
          newStreak = existingStats.current_streak;
        } else if (diffDays === 1) {
          // Jour consécutif, incrémenter
          newStreak = existingStats.current_streak + 1;
        } else {
          // Streak cassée, recommencer à 1
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      // Mettre à jour le longest streak si nécessaire
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }

      // Streak de réussites d'affilée : "je savais" (medium, ou easy de l'ancien
      // système à 3 boutons) l'incrémente, "à revoir" (hard) la remet à zéro
      const newAnswerStreak = response === 'hard' ? 0 : (existingStats.current_answer_streak || 0) + 1;
      const newBestAnswerStreak = Math.max(existingStats.best_answer_streak || 0, newAnswerStreak);

      // Mettre à jour l'array des jours d'étude
      const studyDays = existingStats.study_days || [];
      if (!studyDays.includes(today)) {
        studyDays.push(today);
      }

      // Mettre à jour les stats
      const { error: updateError } = await supabase
        .from('user_stats')
        .update({
          total_reviews: (existingStats.total_reviews || 0) + 1,
          correct_reviews: (existingStats.correct_reviews || 0) + (response !== 'hard' ? 1 : 0),
          hard_reviews: (existingStats.hard_reviews || 0) + (response === 'hard' ? 1 : 0),
          medium_reviews: (existingStats.medium_reviews || 0) + (response === 'medium' ? 1 : 0),
          easy_reviews: (existingStats.easy_reviews || 0) + (response === 'easy' ? 1 : 0),
          total_study_time: (existingStats.total_study_time || 0) + studyTime,
          current_streak: newStreak,
          longest_streak: newLongestStreak,
          current_answer_streak: newAnswerStreak,
          best_answer_streak: newBestAnswerStreak,
          last_study_date: today,
          study_days: studyDays,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        logError('StatsTracker.trackReview/update', updateError);
      }
    } catch (error) {
      logError('StatsTracker.trackReview', error);
    }
  }

  /**
   * Met à jour le compteur de cartes maîtrisées/difficiles
   */
  static async updateCardDifficultyStats(userId: string): Promise<void> {
    try {
      // ✅ 1. Récupérer d'abord les IDs des decks de l'utilisateur
      const { data: decks } = await supabase
        .from('decks')
        .select('id')
        .eq('user_id', userId);

      if (!decks || decks.length === 0) {
        // Pas de decks, mettre les stats à 0
        await supabase
          .from('user_stats')
          .update({
            cards_mastered: 0,
            cards_difficult: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        return;
      }

      const deckIds = decks.map(d => d.id);

      // ✅ 2. Compter les cartes maîtrisées avec .in()
      // Seuils alignés sur utils/fsrs.ts getCardMastery() : "maîtrisé" = stabilité >= 21j et difficulté <= 6.
      const { count: masteredCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .in('deck_id', deckIds)
        .gte('stability', 21)
        .lte('difficulty', 6);

      // ✅ 3. Compter les cartes difficiles avec .in()
      const { count: difficultCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .in('deck_id', deckIds)
        .gte('lapses', 3);

      // 4. Mettre à jour
      await supabase
        .from('user_stats')
        .update({
          cards_mastered: masteredCount || 0,
          cards_difficult: difficultCount || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    } catch (error) {
      logError('StatsTracker.updateCardDifficultyStats', error);
    }
  }

  /**
   * Récupère les stats complètes de l'utilisateur
   */
  static async getUserStats(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logError('StatsTracker.getUserStats', error);
        return null;
      }

      return data;
    } catch (error) {
      logError('StatsTracker.getUserStats', error);
      return null;
    }
  }

  /**
   * Récupère les stats "live" (nombre de cartes, decks, etc.)
   */
  static async getLiveStats(userId: string): Promise<{
    totalCards: number;
    totalDecks: number;
    cardsReviewed: number;
  }> {
    try {
      // ✅ 1. Nombre de decks
      const { count: decksCount } = await supabase
        .from('decks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // ✅ 2. Récupérer les IDs des decks
      const { data: decks } = await supabase
        .from('decks')
        .select('id')
        .eq('user_id', userId);

      if (!decks || decks.length === 0) {
        return {
          totalDecks: decksCount || 0,
          totalCards: 0,
          cardsReviewed: 0,
        };
      }

      const deckIds = decks.map(d => d.id);

      // ✅ 3. Nombre total de cartes avec .in()
      const { count: cardsCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .in('deck_id', deckIds);

      // ✅ 4. Nombre de cartes révisées avec .in()
      const { count: reviewedCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .in('deck_id', deckIds)
        .gt('repetitions', 0);

      return {
        totalDecks: decksCount || 0,
        totalCards: cardsCount || 0,
        cardsReviewed: reviewedCount || 0,
      };
    } catch (error) {
      logError('StatsTracker.getLiveStats', error);
      return {
        totalDecks: 0,
        totalCards: 0,
        cardsReviewed: 0,
      };
    }
  }

  /**
   * Formatte le temps d'étude
   */
  static formatStudyTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
  }
}