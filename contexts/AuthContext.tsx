// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<{ data: any; error: any | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
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

  useEffect(() => {
    
    // Vérifier si on est en mode démo
    const checkDemoMode = async () => {
      try {
        const isDemoMode = await AsyncStorage.getItem('isDemoMode');
        if (isDemoMode === 'true') {
          const demoUserStr = await AsyncStorage.getItem('demoUser');
          if (demoUserStr) {
            const demoUser = JSON.parse(demoUserStr);
            setUser(demoUser);
            setSession({ user: demoUser } as any);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
      }

      // Récupérer la session Supabase normale
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
        } else {
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
    };

    checkDemoMode();

    // Écouter les changements d'auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      
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

      
      if (data.user && !data.user.email_confirmed_at) {
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