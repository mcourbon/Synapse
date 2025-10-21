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
    console.log('🔄 Initialisation de l\'authentification...');
    
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
            console.log('🎮 Mode démo restauré');
            return;
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du mode démo:', error);
      }

      // Récupérer la session Supabase normale
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('❌ Erreur lors de la récupération de la session:', error);
        } else {
          console.log('📊 Session récupérée:', session ? 'Connecté' : 'Non connecté');
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
      console.log('🔔 Changement d\'état d\'auth:', event, session ? 'Connecté' : 'Déconnecté');
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Gestion spécifique des événements
      switch (event) {
        case 'SIGNED_IN':
          console.log('✅ Utilisateur connecté:', session?.user?.email);
          break;
        case 'SIGNED_OUT':
          console.log('👋 Utilisateur déconnecté');
          // Nettoyer le mode démo lors de la déconnexion
          await AsyncStorage.removeItem('isDemoMode');
          await AsyncStorage.removeItem('demoUser');
          break;
        case 'TOKEN_REFRESHED':
          console.log('🔄 Token rafraîchi');
          break;
        case 'USER_UPDATED':
          console.log('👤 Utilisateur mis à jour');
          break;
      }
    });

    return () => {
      console.log('🧹 Nettoyage de l\'abonnement auth');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    console.log('🔄 Tentative d\'inscription pour:', email);
    
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
        console.error('❌ Erreur d\'inscription:', error.message);
        return { data: null, error };
      }

      console.log('✅ Inscription réussie:', data.user?.email);
      
      if (data.user && !data.user.email_confirmed_at) {
        console.log('📧 Email de confirmation envoyé');
      }

      return { data, error: null };
    } catch (err) {
      console.error('💥 Erreur inattendue lors de l\'inscription:', err);
      const error = err as AuthError;
      return { data: null, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 Tentative de connexion pour:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erreur de connexion:', error.message);
        return { data: null, error };
      }

      console.log('✅ Connexion réussie:', data.user?.email);
      return { data, error: null };
    } catch (err) {
      console.error('💥 Erreur inattendue lors de la connexion:', err);
      const error = err as AuthError;
      return { data: null, error };
    }
  };

  const signInAsGuest = async () => {
    console.log('🎮 Activation du mode démo...');
    
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
      
      console.log('✅ Mode démo activé');
      return { data: demoUser, error: null };
    } catch (error) {
      console.error('❌ Erreur mode démo:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    console.log('🔄 Déconnexion en cours...');
    
    try {
      // Vérifier si on est en mode démo
      const isDemoMode = await AsyncStorage.getItem('isDemoMode');
      
      if (isDemoMode === 'true') {
        // Déconnexion du mode démo
        await AsyncStorage.removeItem('isDemoMode');
        await AsyncStorage.removeItem('demoUser');
        setSession(null);
        setUser(null);
        console.log('✅ Déconnexion du mode démo réussie');
        return;
      }

      // Déconnexion Supabase normale
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Erreur lors de la déconnexion:', error.message);
        throw error;
      }

      setSession(null);
      setUser(null);
      
      console.log('✅ Déconnexion réussie');
    } catch (err) {
      console.error('💥 Erreur inattendue lors de la déconnexion:', err);
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