// components/ConfirmModal.tsx
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmModal}>
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
        </View>
      </View>
    </Modal>
  );
}
