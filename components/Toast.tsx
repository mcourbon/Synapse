// components/Toast.tsx
import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
  onHide: () => void;
}

const staticStyles = StyleSheet.create({
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default function Toast({ visible, message, type, onHide }: ToastProps) {
  const { theme } = useTheme();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  const styles = StyleSheet.create({
    toast: {
      position: 'absolute',
      top: 75,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      gap: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 1000,
      alignSelf: 'center',
    },
    toastSuccess: {
      backgroundColor: theme.success,
    },
    toastError: {
      backgroundColor: theme.error,
    },
  });

  return (
    <View style={[styles.toast, type === 'success' ? styles.toastSuccess : styles.toastError]}>
      <Ionicons
        name={type === 'success' ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color="#fff"
      />
      <Text style={staticStyles.toastText}>{message}</Text>
    </View>
  );
}
