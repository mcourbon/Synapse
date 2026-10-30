// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setGuestMode, isGuestMode } from '../lib/guestMode';
import { resetLocalData } from '../lib/localDb';
import { logError } from '../lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Le serveur n'a pas répondu au démarrage — voir loadSession. */
  connectionError: boolean;
  retryConnection: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<{ data: any; error: any | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  connectionError: false,
  retryConnection: async () => {},
  signUp: async () => ({ data: null, error: null }),
  signIn: async () => ({ data: null, error: null }),
  signOut: async () => {},
  signInAsGuest: async () => ({ data: null, error: null }),
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  // Session Supabase normale. Serveur injoignable (réseau coupé, projet en pause) :
  // on reste sur l'écran de chargement avec un message et "Réessayer", plutôt que
  // d'afficher l'écran de connexion comme si l'utilisateur était déconnecté.
  const loadSession = async () => {
    setConnectionError(false);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      logError('AuthContext.getSession', error);
      if (isAuthRetryableFetchError(error)) {
        setConnectionError(true);
        return;
      }
    }

    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  };

  useEffect(() => {
    
    // Vérifier si on est en mode démo
    const checkDemoMode = async () => {
      try {
        const isDemoMode = await AsyncStorage.getItem('isDemoMode');
        if (isDemoMode === 'true') {
          const demoUserStr = await AsyncStorage.getItem('demoUser');
          if (demoUserStr) {
            const demoUser = JSON.parse(demoUserStr);
            setGuestMode(true);
            setUser(demoUser);
            setSession({ user: demoUser } as any);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        logError('AuthContext.checkDemoMode', error);
      }

      await loadSession();
    };

    checkDemoMode();

    // Écouter les changements d'auth Supabase — ignorés tant qu'on est en mode démo local,
    // sinon cet écouteur écrase l'utilisateur démo dès qu'il se déclenche (ex: au reload de la page).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isGuestMode()) return;
      // La session de départ est gérée par loadSession() : en cas d'erreur réseau,
      // cet événement arrive avec une session nulle et enverrait vers l'écran de
      // connexion alors que l'utilisateur est toujours connecté sur l'appareil.
      if (event === 'INITIAL_SESSION') return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Gestion spécifique des événements
      switch (event) {
        case 'SIGNED_IN':
          break;
        case 'SIGNED_OUT':
          // Nettoyer le mode démo lors de la déconnexion
          await AsyncStorage.removeItem('isDemoMode');
          await AsyncStorage.removeItem('demoUser');
          setGuestMode(false);
          break;
        case 'TOKEN_REFRESHED':
          break;
        case 'USER_UPDATED':
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            created_at: new Date().toISOString(),
          }
        }
      });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      const error = err as AuthError;
      return { data: null, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      const error = err as AuthError;
      return { data: null, error };
    }
  };

  const signInAsGuest = async () => {
    
    try {
      const demoUser = {
        id: 'demo-user-local',
        email: 'demo@local',
        isGuest: true,
        created_at: new Date().toISOString(),
      } as any;
      
      await AsyncStorage.setItem('isDemoMode', 'true');
      await AsyncStorage.setItem('demoUser', JSON.stringify(demoUser));

      setGuestMode(true);
      setUser(demoUser);
      setSession({ user: demoUser } as any);
      
      return { data: demoUser, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    
    try {
      // Vérifier si on est en mode démo
      const isDemoMode = await AsyncStorage.getItem('isDemoMode');
      
      if (isDemoMode === 'true') {
        // Déconnexion du mode démo
        await AsyncStorage.removeItem('isDemoMode');
        await AsyncStorage.removeItem('demoUser');
        await resetLocalData();
        setGuestMode(false);
        setSession(null);
        setUser(null);
        return;
      }

      // Déconnexion Supabase normale
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      setSession(null);
      setUser(null);
      
    } catch (err) {
      throw err;
    }
  };

  const value = {
    user,
    session,
    loading,
    connectionError,
    retryConnection: loadSession,
    signUp,
    signIn,
    signOut,
    signInAsGuest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};