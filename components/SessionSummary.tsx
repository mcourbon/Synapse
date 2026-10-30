// components/SessionSummary.tsx
// Résumé chiffré du modal de fin de session (révision et entraînement) : cartes sues
// du premier coup, cartes à revoir, durée. Les trois blocs apparaissent en cascade
// (fondu + légère montée) pendant que le cercle de progression se remplit —
// startSummaryAnimation() est lancé à l'ouverture du modal.
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SWIPE_AGAIN_COLOR, SWIPE_KNEW_COLOR } from './SwipeableCard';

// Couleurs hardcodées — module level (iOS safe)
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 28,
  },
  value: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 6,
  },
  knewValue: { color: SWIPE_KNEW_COLOR },
  againValue: { color: SWIPE_AGAIN_COLOR },
});

/** Réponses d'une session, par carte : true = sue du premier coup. */
export type SessionResults = Record<string, boolean>;

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function endSessionMessage(results: SessionResults): string {
  const values = Object.values(results);
  const count = values.length;
  const cards = `${count} carte${count > 1 ? 's' : ''}`;
  if (count > 0 && values.every(Boolean)) return `Sans faute sur ${cards}, excellent travail !`;
  return `Vous avez révisé ${cards} aujourd'hui. Excellent travail !`;
}

export function startSummaryAnimation(progress: Animated.Value) {
  progress.setValue(0);
  Animated.timing(progress, {
    toValue: 1,
    duration: 900,
    delay: 450,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();
}

interface SessionSummaryProps {
  results: SessionResults;
  durationSeconds: number;
  progress: Animated.Value;
}

export default function SessionSummary({ results, durationSeconds, progress }: SessionSummaryProps) {
  const { theme } = useTheme();
  const values = Object.values(results);
  const knew = values.filter(Boolean).length;
  const again = values.length - knew;

  const dynamicStyles = StyleSheet.create({
    block: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: theme.background,
    },
    durationValue: { color: theme.primary },
    label: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });

  const blocks = [
    { icon: 'checkmark-circle' as const, color: SWIPE_KNEW_COLOR, value: String(knew), valueStyle: styles.knewValue, label: 'Je savais' },
    { icon: 'refresh-circle' as const, color: SWIPE_AGAIN_COLOR, value: String(again), valueStyle: styles.againValue, label: 'À revoir' },
    { icon: 'time' as const, color: theme.primary, value: formatDuration(durationSeconds), valueStyle: dynamicStyles.durationValue, label: 'Durée' },
  ];

  return (
    <View style={styles.row}>
      {blocks.map((block, index) => {
        // Cascade : chaque bloc démarre un peu après le précédent
        const start = index * 0.2;
        const opacity = progress.interpolate({
          inputRange: [start, start + 0.6],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });
        const translateY = progress.interpolate({
          inputRange: [start, start + 0.6],
          outputRange: [12, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View key={block.label} style={[dynamicStyles.block, { opacity, transform: [{ translateY }] }]}>
            <Ionicons name={block.icon} size={22} color={block.color} />
            <Text style={[styles.value, block.valueStyle]}>{block.value}</Text>
            <Text style={dynamicStyles.label}>{block.label}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
