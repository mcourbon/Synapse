// components/InfoModal.tsx
import { View, Text, Modal, Pressable, ScrollView, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  children: React.ReactNode;
}

// Couleurs hardcodées — module level (iOS safe, jamais dans StyleSheet inside component)
const staticStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
});

export default function InfoModal({ visible, onClose, title, icon, iconColor, children }: InfoModalProps) {
  const { theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pressStartedOnOverlay = useRef(false);

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => onClose());
  };

  const styles = StyleSheet.create({
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 28,
      padding: 0,
      width: '100%',
      maxWidth: 420,
      // % se résolvait contre une hauteur de référence erronée du Modal une fois
      // statusBarTranslucent activé (bug connu RN Android) — écrasait le contenu
      // à quasi rien, ne laissant que le header visible. Calcul en pixels à la place.
      maxHeight: windowHeight * 0.85,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + '40',
    },
    modalTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    closeButtonCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.border + '30',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border + '50',
    },
    modalIconContainer: {
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 24,
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: iconColor + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
  });

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={handleClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Pressable
          style={staticStyles.modalOverlay}
          onPressIn={(e: any) => {
            // Le pointerdown est fiable pour savoir où le geste a réellement démarré
            // (contrairement au relâchement, utilisé par une sélection de texte qui dérape).
            pressStartedOnOverlay.current = e.target === e.currentTarget;
          }}
          onPress={() => {
            if (pressStartedOnOverlay.current) handleClose();
          }}
        >
          <Pressable style={[styles.modalContent, staticStyles.modalContentShadow]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={{ width: 36 }} />
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable onPress={handleClose} style={styles.closeButtonCircle}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalIconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name={icon} size={36} color={iconColor} />
                </View>
              </View>

              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
