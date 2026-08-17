// app/_layout.tsx
import { Stack, usePathname } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { StatsProvider } from '../contexts/StatsContext';
import AuthScreen from '../components/AuthScreen';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
// Import pour effet de bord : enregistre la tâche de fond des rappels de révision
// (doit être chargé dès le démarrage pour que l'OS puisse la retrouver en arrière-plan).
import '../lib/notifications';

// Routes accessibles sans connexion (ex: page publique exigée par le Play Store)
const PUBLIC_ROUTES = ['/politique-de-confidentialite'];

// Supprime l'outline natif du navigateur sur les inputs (web uniquement)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none !important; }';
  document.head.appendChild(style);
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Créer les styles avec le thème dynamique
  const dynamicStyles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
  });

  if (!isPublicRoute) {
    if (loading) {
      return (
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
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
      <Stack.Screen name="card/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="politique-de-confidentialite"
        options={{ headerShown: false }}
      />
      {/* Pas de route review/global : la révision se fait désormais directement sur
          l'écran d'accueil (app/index.tsx, mode 'home' <-> 'review'), sans jamais
          naviguer — voir le commentaire en tête de ce fichier-là. Toute route ici
          (modal ou push, `animation` quelle qu'elle soit) déclenche sa propre
          transition native qu'aucune combinaison de props n'a réussi à faire
          coïncider avec l'animation JS voulue (coupure noire + glissement
          parasite au tap sur la tinycard) — cf. git history sur ce fichier. */}
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