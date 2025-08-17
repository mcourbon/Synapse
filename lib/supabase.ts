import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)