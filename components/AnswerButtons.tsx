// components/AnswerButtons.tsx
// Les deux réponses de révision ("À revoir" / "Je savais"), alternative au swipe de
// useCardSwipe (components/SwipeableCard.tsx) — même action, utile d'une main, sur
// web, ou pour qui préfère taper.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SwipeDirection } from './SwipeableCard';

// Couleurs hardcodées — module level (iOS safe)
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
  },
  againLight: { backgroundColor: '#FFF5F5', borderColor: '#FF3B30' },
  againDark: { backgroundColor: '#4A1A1A', borderColor: '#FF3B30' },
  knewLight: { backgroundColor: '#F0FFF4', borderColor: '#34C759' },
  knewDark: { backgroundColor: '#1A3A1A', borderColor: '#34C759' },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  labelLight: { color: '#333' },
  labelDark: { color: '#fff' },
});

interface AnswerButtonsProps {
  onAnswer: (direction: SwipeDirection) => void;
}

export default function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
  const { theme, isDark } = useTheme();

  const dynamicStyles = StyleSheet.create({
    hint: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 14,
    },
  });

  return (
    <View>
      <Text style={dynamicStyles.hint}>Swipez la carte, ou :</Text>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isDark ? styles.againDark : styles.againLight,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => onAnswer('left')}
        >
          <Ionicons name="close-circle" size={24} color="#FF3B30" />
          <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>À revoir</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isDark ? styles.knewDark : styles.knewLight,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => onAnswer('right')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#34C759" />
          <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>Je savais</Text>
        </Pressable>
      </View>
    </View>
  );
}
