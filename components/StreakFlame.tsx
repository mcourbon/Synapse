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
      marginTop: 15,
    },
    badge: {
      minWidth: 48,
      height: 48,
      borderRadius: 24,
      paddingHorizontal: 12,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 15,
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
