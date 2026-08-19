// components/StreakFlame.tsx
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface StreakFlameProps {
  streak: number;
}

export default function StreakFlame({ streak }: StreakFlameProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevStreak = useRef(streak);

  useEffect(() => {
    if (streak > prevStreak.current) {
      scaleAnim.setValue(1.35);
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }).start();
    }
    prevStreak.current = streak;
  }, [streak]);

  const styles = StyleSheet.create({
    placeholder: {
      width: 48,
    },
    badge: {
      minWidth: 48,
      height: 48,
      borderRadius: 24,
      // Padding asymétrique : la flamme (pleine, encre jusqu'aux bords de son cadre
      // 20x20) et le chiffre (glyphes proportionnels, surtout "1") n'ont pas le même
      // poids visuel à espace égal — un padding 12/12 identique donne l'impression
      // qu'il reste plus d'air à droite du chiffre qu'à gauche de la flamme, surtout
      // visible à partir de 2 chiffres. Corrigé à l'œil, pas déduit d'une formule.
      paddingLeft: 14,
      paddingRight: 10,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    text: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      // Chiffres à largeur fixe : évite qu'un "1" plus étroit que les autres
      // chiffres fasse bouger le centrage au fil des re-renders.
      fontVariant: ['tabular-nums'],
    },
  });

  if (streak <= 0) {
    return <View style={styles.placeholder} />;
  }

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]}>
      <Ionicons name="flame" size={20} color="#FF9500" />
      <Text style={styles.text}>{streak}</Text>
    </Animated.View>
  );
}
