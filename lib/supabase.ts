import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
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

// Sans storage explicite, supabase-js garde la session en mémoire (pas de
// localStorage sur React Native) : elle disparaît dès que l'app est tuée,
// obligeant à se reconnecter à chaque relance. AsyncStorage la persiste sur
// le disque comme sur web.
const realSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Recommandation Supabase pour React Native : sans ça, le timer de refresh du
// token continue de tourner en arrière-plan et peut déclencher des retries
// inutiles pendant que l'app est backgroundée.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    realSupabase.auth.startAutoRefresh();
  } else {
    realSupabase.auth.stopAutoRefresh();
  }
});

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