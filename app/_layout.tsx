// app/_layout.tsx
import { Stack, usePathname } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { StatsProvider } from '../contexts/StatsContext';
import AuthScreen from '../components/AuthScreen';
import { ActivityIndicator, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
// Import pour effet de bord : enregistre la tâche de fond des rappels de révision
// (doit être chargé dès le démarrage pour que l'OS puisse la retrouver en arrière-plan).
import '../lib/notifications';

// Couleurs hardcodées — module level (iOS safe)
const styles = StyleSheet.create({
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// Routes accessibles sans connexion (ex: page publique exigée par le Play Store)
const PUBLIC_ROUTES = ['/politique-de-confidentialite'];

// Supprime l'outline natif du navigateur sur les inputs (web uniquement)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none !important; }';
  document.head.appendChild(style);
}

function RootLayoutNav() {
  const { user, loading, connectionError, retryConnection } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Chargement qui traîne (serveur lent à se réveiller) : un mot sous le spinner
  // pour montrer que l'app n'est pas figée, avant l'éventuel "Serveur injoignable".
  const [slowLoading, setSlowLoading] = useState(false);
  useEffect(() => {
    if (!loading || connectionError) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 5000);
    return () => clearTimeout(timer);
  }, [loading, connectionError]);

  // Créer les styles avec le thème dynamique
  const dynamicStyles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      backgroundColor: theme.background,
    },
    loadingTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    loadingMessage: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 12,
      marginTop: 24,
    },
  });

  if (!isPublicRoute) {
    if (loading) {
      return (
        <View style={dynamicStyles.loadingContainer}>
          {connectionError ? (
            <>
              <Ionicons name="cloud-offline-outline" size={48} color={theme.textSecondary} />
              <Text style={dynamicStyles.loadingTitle}>Serveur injoignable</Text>
              <Text style={dynamicStyles.loadingMessage}>
                Vérifiez votre connexion internet puis réessayez.
              </Text>
              <Pressable
                style={({ pressed }) => [dynamicStyles.retryButton, pressed && { opacity: 0.7 }]}
                onPress={retryConnection}
              >
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={theme.primary} />
              {slowLoading && (
                <Text style={dynamicStyles.loadingMessage}>Connexion au serveur…</Text>
              )}
            </>
          )}
        </View>
      );
    }

    if (!user) {
      return <AuthScreen />;
    }
  }

  return (
    // Android dessine en edge-to-edge (SDK 53) : sans contentStyle, la zone sous la
    // barre de statut / l'encoche caméra reste peinte en blanc (fond de fenêtre natif
    // par défaut) au lieu du fond du thème — visible en haut d'écran sur Pixel.
    <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="decks" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="deck/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="politique-de-confidentialite"
        options={{ headerShown: false }}
      />
      {/* Ni review/global ni card/[id] : révision et entraînement se font tous les
          deux directement sur leur écran parent (app/index.tsx mode 'home'<->'review',
          app/deck/[id].tsx mode 'list'<->'training'), sans jamais naviguer — voir les
          commentaires en tête de ces fichiers-là. Toute route ici (modal ou push,
          `animation` quelle qu'elle soit) déclenche sa propre transition native
          qu'aucune combinaison de props n'a réussi à faire coïncider avec l'animation
          JS voulue (coupure noire + glissement parasite / écran figé au tap) —
          cf. git history sur ce fichier. */}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatsProvider>
          <RootLayoutNav />
        </StatsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}