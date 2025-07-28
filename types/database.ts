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
  front: string;        // ✅ Ajouté
  back: string;         // ✅ Ajouté
  created_at: string;
  updated_at?: string;
  // Propriétés optionnelles pour la spaced repetition (futures)
  next_review?: string;
  difficulty?: number;
  review_count?: number;
  // Relation avec le deck (pour les jointures)
  decks?: Deck;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}