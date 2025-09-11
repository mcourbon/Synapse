// types/database.ts
export interface Deck {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at?: string;
  // Propriétés optionnelles pour la spaced repetition
  next_review?: string;
  difficulty?: number;
  review_count?: number;
  interval?: number;
  repetitions?: number;
  ease_factor?: number;
  last_reviewed?: string;
  // Relation avec le deck
  decks?: Deck;
  categories?: string[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  username?: string | null;
  collections_created: number;
  cards_studied: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  total_reviews: number;
  correct_reviews: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
}