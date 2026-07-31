// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Définir les couleurs pour chaque thème
export const lightTheme = {
  // Couleurs principales
  background: '#f5f5f5',
  surface: '#ffffff',
  primary: '#007AFF',
  accent: '#FF9500',

  // Textes
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',

  // États
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',

  // Bordures et séparateurs
  border: '#e9ecef',

  // Ombres
  shadow: '#000000',
};

export const darkTheme = {
  // Couleurs principales
  background: '#1a1a1a',
  surface: '#2d2d30',
  primary: '#0A84FF',
  accent: '#FF9F0A',

  // Textes
  text: '#ffffff',
  textSecondary: '#e1e1e1',
  textMuted: '#a1a1a6',

  // États
  error: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',

  // Bordures et séparateurs
  border: '#484848',

  // Ombres
  shadow: '#000000',
};

export type Theme = typeof lightTheme;

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Charger le thème sauvegardé au démarrage
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      } else {
        // Si aucun thème sauvegardé, utiliser le thème système
        const systemTheme = Appearance.getColorScheme();
        setIsDark(systemTheme === 'dark');
      }
    } catch (error) {
      // Fallback sur le thème système
      const systemTheme = Appearance.getColorScheme();
      setIsDark(systemTheme === 'dark');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTheme = async (darkMode: boolean) => {
    try {
      await AsyncStorage.setItem('theme', darkMode ? 'dark' : 'light');
    } catch (error) {
    }
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    saveTheme(newIsDark);
  };

  const theme = isDark ? darkTheme : lightTheme;

  if (isLoading) {
    return null; // Ou un écran de chargement
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  }
  return context;
}