// contexts/StatsContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useAuth } from './AuthContext';
import { StatsTracker } from '../lib/statsTracker';

export interface UserStats {
  totalCards: number;
  totalDecks: number;
  cardsReviewed: number;
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  successRate: number;
  hardReviews: number;
  mediumReviews: number;
  easyReviews: number;
  totalStudyTime: number;
  cardsMastered: number;
  cardsDifficult: number;
  studyDays: string[];
}

export interface UserProfile {
  id: string;
  username: string | null;
  email: string;
  created_at: string;
  avatar_url?: string | null;
}

interface StatsContextType {
  stats: UserStats;
  userProfile: UserProfile | null;
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refreshStats: () => void;
}

const defaultStats: UserStats = {
  totalCards: 0,
  totalDecks: 0,
  cardsReviewed: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalReviews: 0,
  successRate: 0,
  hardReviews: 0,
  mediumReviews: 0,
  easyReviews: 0,
  totalStudyTime: 0,
  cardsMastered: 0,
  cardsDifficult: 0,
  studyDays: [],
};

const StatsContext = createContext<StatsContextType>({
  stats: defaultStats,
  userProfile: null,
  avatarUrl: null,
  setAvatarUrl: () => {},
  setUserProfile: () => {},
  refreshStats: () => {},
});

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const [liveStats] = await Promise.all([
        StatsTracker.getLiveStats(user.id),
        StatsTracker.updateCardDifficultyStats(user.id),
      ]);

      const userStats = await StatsTracker.getUserStats(user.id);

      if (userStats) {
        setUserProfile({
          id: userStats.user_id,
          username: userStats.username,
          email: user.email || '',
          created_at: user.created_at || '',
          avatar_url: userStats.avatar_url,
        });
        setAvatarUrl(userStats.avatar_url || null);
      }

      setStats({
        totalCards: liveStats.totalCards,
        totalDecks: liveStats.totalDecks,
        cardsReviewed: liveStats.cardsReviewed,
        currentStreak: userStats?.current_streak || 0,
        successRate: StatsTracker.calculateSuccessRate(userStats),
        longestStreak: userStats?.longest_streak || 0,
        totalReviews: userStats?.total_reviews || 0,
        hardReviews: userStats?.hard_reviews || 0,
        mediumReviews: userStats?.medium_reviews || 0,
        easyReviews: userStats?.easy_reviews || 0,
        totalStudyTime: userStats?.total_study_time || 0,
        cardsMastered: userStats?.cards_mastered || 0,
        cardsDifficult: userStats?.cards_difficult || 0,
        studyDays: userStats?.study_days || [],
      });
    } catch {
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStats();
    } else {
      setStats(defaultStats);
      setUserProfile(null);
      setAvatarUrl(null);
    }
  }, [user]);

  return (
    <StatsContext.Provider value={{
      stats,
      userProfile,
      avatarUrl,
      setAvatarUrl,
      setUserProfile,
      refreshStats: fetchStats,
    }}>
      {children}
    </StatsContext.Provider>
  );
}

export const useStats = () => useContext(StatsContext);
