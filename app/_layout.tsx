// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { StatsProvider } from '../contexts/StatsContext';
import AuthScreen from '../components/AuthScreen';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';

// Supprime l'outline natif du navigateur sur les inputs (web uniquement)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none !important; }';
  document.head.appendChild(style);
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  // Créer les styles avec le thème dynamique
  const dynamicStyles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
  });

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

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="decks" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="deck/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="card/[id]" options={{ headerShown: false }} />
      <Stack.Screen 
        name="review/global" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }} 
      />
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