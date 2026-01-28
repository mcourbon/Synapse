// lib/statsTracker.ts
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        console.error('Erreur fetch stats:', fetchError);
        return;
      }

      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD

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
            last_study_date: today,
            study_days: [today],
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Erreur création stats:', insertError);
        }
        return;
      }

      // Calculer la nouvelle streak
      const lastStudyDate = existingStats.last_study_date;
      let newStreak = existingStats.current_streak || 0;
      let newLongestStreak = existingStats.longest_streak || 0;

      if (lastStudyDate) {
        const lastDate = new Date(lastStudyDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
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
          last_study_date: today,
          study_days: studyDays,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erreur update stats:', updateError);
      }
    } catch (error) {
      console.error('Erreur tracking review:', error);
    }
  }

  /**
   * Met à jour le compteur de cartes maîtrisées/difficiles
   */
  static async updateCardDifficultyStats(userId: string): Promise<void> {
    try {
      // Compter les cartes maîtrisées (repetitions >= 6 et ease_factor > 2.3)
      const { count: masteredCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('decks.user_id', userId)
        .gte('repetitions', 6)
        .gte('ease_factor', 2.3);

      // Compter les cartes difficiles (lapses >= 3)
      const { count: difficultCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('decks.user_id', userId)
        .gte('lapses', 3);

      // Mettre à jour
      await supabase
        .from('user_stats')
        .update({
          cards_mastered: masteredCount || 0,
          cards_difficult: difficultCount || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    } catch (error) {
      console.error('Erreur update difficulty stats:', error);
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
        console.error('Erreur get stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur getUserStats:', error);
      return null;
    }
  }

  /**
   * Calcule le taux de réussite
   */
  static calculateSuccessRate(stats: any): number {
    if (!stats || !stats.total_reviews || stats.total_reviews === 0) {
      return 0;
    }
    return Math.round((stats.correct_reviews / stats.total_reviews) * 100);
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
      // Nombre de decks
      const { count: decksCount } = await supabase
        .from('decks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Nombre total de cartes
      const { count: cardsCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('decks.user_id', userId);

      // Nombre de cartes révisées (repetitions > 0)
      const { count: reviewedCount } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('decks.user_id', userId)
        .gt('repetitions', 0);

      return {
        totalDecks: decksCount || 0,
        totalCards: cardsCount || 0,
        cardsReviewed: reviewedCount || 0,
      };
    } catch (error) {
      console.error('Erreur getLiveStats:', error);
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

  /**
   * Génère les données pour la heatmap (style GitHub)
   */
  static generateHeatmapData(studyDays: string[], daysToShow: number = 90): Array<{
    date: string;
    count: number;
  }> {
    const today = new Date();
    const heatmapData: Array<{ date: string; count: number }> = [];

    // Créer un compteur de reviews par jour
    const daysCounts: { [key: string]: number } = {};
    studyDays.forEach(day => {
      daysCounts[day] = (daysCounts[day] || 0) + 1;
    });

    // Générer les derniers X jours
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      heatmapData.push({
        date: dateStr,
        count: daysCounts[dateStr] || 0,
      });
    }

    return heatmapData;
  }
}