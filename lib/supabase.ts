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

// Sans délai max, une requête vers un serveur injoignable (projet Supabase en pause :
// le DNS ne répond plus) peut rester pendante plusieurs minutes sur Android, et l'app
// tourne dans le vide au démarrage. Passé ce délai la requête échoue comme une erreur
// réseau, ce que l'écran de chargement sait afficher (voir AuthContext).
const REQUEST_TIMEOUT_MS = 20000; // large : couvre aussi l'upload d'avatar en 4G moyenne

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Respecte un signal déjà fourni par l'appelant en plus du nôtre
  init?.signal?.addEventListener?.('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

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
  global: { fetch: fetchWithTimeout },
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