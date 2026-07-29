// components/StatTile.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface StatTileProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  textColor: string;
  value: string | number;
  label: string;
}

const staticStyles = StyleSheet.create({
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default function StatTile({ icon, iconColor, textColor, value, label }: StatTileProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    card: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
  });

  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={[staticStyles.value, { color: textColor }]}>{value}</Text>
      <Text style={[staticStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}
