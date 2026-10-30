// components/UndoButton.tsx
// Petit bouton discret "Annuler" sous le compteur de cartes (révision et
// entraînement) : revient sur la dernière réponse, pour un swipe parti du mauvais
// côté. La carte revient face réponse, prête à être re-swipée.
import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

interface UndoButtonProps {
  onPress: () => void;
}

export default function UndoButton({ onPress }: UndoButtonProps) {
  const { theme } = useTheme();

  const dynamicStyles = StyleSheet.create({
    button: { backgroundColor: theme.surface },
    label: { color: theme.textSecondary },
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.button, dynamicStyles.button, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Annuler la dernière réponse"
    >
      <Ionicons name="arrow-undo" size={13} color={theme.textSecondary} />
      <Text style={[styles.label, dynamicStyles.label]}>Annuler</Text>
    </Pressable>
  );
}
