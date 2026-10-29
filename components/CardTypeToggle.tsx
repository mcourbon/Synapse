// components/CardTypeToggle.tsx
// Choix du type de carte à la création/modification : question-réponse classique,
// ou fiche (recto seul, dévoilé ligne par ligne en révision — voir utils/fiche.ts).
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface CardTypeToggleProps {
  isFiche: boolean;
  onChange: (isFiche: boolean) => void;
}

// Couleurs hardcodées — module level (iOS safe)
const staticStyles = StyleSheet.create({
  selectedText: { color: '#fff' },
});

export default function CardTypeToggle({ isFiche, onChange }: CardTypeToggleProps) {
  const { theme } = useTheme();

  const dynamicStyles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      gap: 4,
    },
    option: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 9,
      alignItems: 'center',
    },
    optionSelected: {
      backgroundColor: theme.primary,
    },
    optionText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
  });

  const options: { label: string; value: boolean }[] = [
    { label: 'Question / Réponse', value: false },
    { label: 'Fiche', value: true },
  ];

  return (
    <View style={dynamicStyles.container}>
      {options.map(option => {
        const selected = option.value === isFiche;
        return (
          <Pressable
            key={option.label}
            style={[dynamicStyles.option, selected && dynamicStyles.optionSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[dynamicStyles.optionText, selected && staticStyles.selectedText]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
