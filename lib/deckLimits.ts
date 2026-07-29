// lib/deckLimits.ts
import { supabase } from './supabase';

/** Nombre max de cartes acceptées en une seule fois depuis un import CSV. */
export const MAX_CARDS_PER_IMPORT = 1000;

/** Nombre max de cartes total dans une collection (import + ajout manuel confondus). */
export const MAX_CARDS_PER_DECK = 2000;

export async function getDeckCardCount(deckId: string): Promise<number> {
  const { count } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId);
  return count ?? 0;
}
