// components/ConfirmModal.tsx
import { View, Text, Modal, Pressable, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  isLoading?: boolean;
}

const staticStyles = StyleSheet.create({
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmColor = '#FF3B30',
  isLoading = false,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const [rendered, setRendered] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }),
      ]).start();
    } else if (rendered) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setRendered(false));
    }
  }, [visible]);

  const styles = StyleSheet.create({
    confirmOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    confirmModal: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 350,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    confirmTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    confirmMessage: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelConfirmButton: {
      backgroundColor: theme.border,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    cancelConfirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    confirmButtonTextDisabled: {
      color: theme.textSecondary,
    },
  });

  if (!rendered) return null;

  return (
    <Modal visible={rendered} animationType="none" transparent onRequestClose={onCancel}>
      <Animated.View style={[styles.confirmOverlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.confirmModal, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>

          <View style={styles.confirmButtons}>
            <Pressable
              style={[styles.confirmButton, styles.cancelConfirmButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelConfirmText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmButton, { backgroundColor: confirmColor }, isLoading && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              <Text style={[staticStyles.confirmButtonText, isLoading && styles.confirmButtonTextDisabled]}>
                {isLoading ? 'Chargement...' : confirmText}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
