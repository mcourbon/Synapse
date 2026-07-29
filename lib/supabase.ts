import { createClient } from '@supabase/supabase-js'
import { isGuestMode } from './guestMode';
import { createLocalTable, LocalTableName } from './localDb';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Vérification des variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement manquantes:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
  throw new Error('Configuration Supabase manquante');
}

const realSupabase = createClient(supabaseUrl, supabaseAnonKey);

const LOCAL_TABLES = new Set(['decks', 'cards', 'user_stats']);

// En mode invité, les requêtes sur decks/cards/user_stats sont routées vers un
// stockage local (AsyncStorage) au lieu de Supabase — voir lib/localDb.ts et lib/guestMode.ts.
export const supabase = new Proxy(realSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => {
        if (isGuestMode() && LOCAL_TABLES.has(table)) {
          return createLocalTable(table as LocalTableName);
        }
        return target.from(table);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
}) as typeof realSupabase;