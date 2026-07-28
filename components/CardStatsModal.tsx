// components/CardStatsModal.tsx
import { View, Text, Modal, Pressable, ScrollView, Animated, Platform, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../types/database';
import { SpacedRepetitionSystem } from '../utils/spacedRepetition';
import { MASTERY_COLORS, MASTERY_LABELS, formatNextReview } from '../utils/cardMastery';

interface CardStatsModalProps {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
}

const staticStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  statValYellow: { color: '#F59E0B', fontSize: 24, fontWeight: '700' },
  statValRed: { color: '#EF4444', fontSize: 24, fontWeight: '700' },
  statValBlue: { color: '#3B82F6', fontSize: 24, fontWeight: '700' },
  statValGray: { color: '#8E8E93', fontSize: 24, fontWeight: '700' },
});

export default function CardStatsModal({ visible, card, onClose }: CardStatsModalProps) {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    statsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    statsSheet: {
      backgroundColor: theme.surface,
      borderRadius: 28,
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 15,
      overflow: 'hidden',
    },
    statsModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + '40',
    },
    statsSheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    statsCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.border + '30',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border + '50',
    },
    statsBody: {
      padding: 20,
    },
    statsPreview: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    statsPreviewFront: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    statsPreviewDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 10,
      opacity: 0.5,
    },
    statsPreviewBack: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    statsMasteryBanner: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    statsGrid: {
      marginBottom: 14,
    },
    statsRow: {
      flexDirection: 'row',
    },
    statsCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 18,
    },
    statsDividerV: {
      width: 1,
      backgroundColor: theme.border + '50',
    },
    statsDividerH: {
      height: 1,
      backgroundColor: theme.border + '50',
    },
    statsCellLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '500',
      marginTop: 4,
      textAlign: 'center',
    },
    statsCellValuePrimary: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.primary,
    },
    statsNextReview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border + '50',
      paddingTop: 14,
      marginTop: 2,
    },
    statsNextReviewLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    statsNextReviewValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.primary,
    },
  });

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={handleClose}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Pressable style={styles.statsOverlay} onPress={handleClose}>
          <Pressable
            style={[styles.statsSheet, card && {
              borderWidth: 2,
              borderColor: (MASTERY_COLORS[SpacedRepetitionSystem.getCardMastery(
                card.repetitions || 0,
                card.ease_factor || 2.5,
                card.lapses || 0
              )] ?? '#8E8E93') + '70',
            }]}
            onPress={e => e.stopPropagation()}
          >
            {card && (() => {
              const mastery = SpacedRepetitionSystem.getCardMastery(
                card.repetitions || 0,
                card.ease_factor || 2.5,
                card.lapses || 0
              );
              const masteryColor = MASTERY_COLORS[mastery] ?? '#8E8E93';
              const streak = card.repetitions || 0;
              const lapses = card.lapses || 0;
              const ease = Math.round(((card.ease_factor || 2.5) - 2.5) * 100);
              const easeLabel = ease >= 0 ? `+${ease}%` : `${ease}%`;
              const nextReviewLabel = formatNextReview(card.next_review);
              const interval = card.interval || 0;
              const neverReviewed = !card.repetitions && !card.last_reviewed;
              const intervalLabel = neverReviewed ? '—' : interval === 0 ? '< 1j' : `${interval}j`;

              return (
                <>
                  {/* Header */}
                  <View style={styles.statsModalHeader}>
                    <View style={{ width: 36 }} />
                    <Text style={styles.statsSheetTitle}>Stats de la carte</Text>
                    <Pressable style={styles.statsCloseButton} onPress={handleClose}>
                      <Ionicons name="close" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  <ScrollView style={styles.statsBody} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false} bounces={Platform.OS === 'ios'}>
                    {/* Aperçu front / back */}
                    <View style={styles.statsPreview}>
                      <Text style={styles.statsPreviewFront}>{card.front}</Text>
                      <View style={styles.statsPreviewDivider} />
                      <Text style={styles.statsPreviewBack}>{card.back}</Text>
                    </View>

                    {/* Mastery banner */}
                    <View style={[styles.statsMasteryBanner, { backgroundColor: masteryColor + '20' }]}>
                      <View style={[staticStyles.badge, { backgroundColor: masteryColor, paddingHorizontal: 14, paddingVertical: 6 }]}>
                        <Text style={[staticStyles.badgeText, { fontSize: 13 }]}>{MASTERY_LABELS[mastery] ?? mastery}</Text>
                      </View>
                    </View>

                    {/* Grille 2x2 */}
                    <View style={styles.statsGrid}>
                      <View style={styles.statsRow}>
                        <View style={styles.statsCell}>
                          <Text style={staticStyles.statValYellow}>{streak}</Text>
                          <Text style={styles.statsCellLabel}>Win Streak</Text>
                        </View>
                        <View style={styles.statsDividerV} />
                        <View style={styles.statsCell}>
                          <Text style={lapses > 0 ? staticStyles.statValRed : staticStyles.statValGray}>{lapses}</Text>
                          <Text style={styles.statsCellLabel}>Lapses</Text>
                        </View>
                      </View>
                      <View style={styles.statsDividerH} />
                      <View style={styles.statsRow}>
                        <View style={styles.statsCell}>
                          <Text style={ease >= 0 ? staticStyles.statValBlue : staticStyles.statValRed}>{easeLabel}</Text>
                          <Text style={styles.statsCellLabel}>Facilité</Text>
                        </View>
                        <View style={styles.statsDividerV} />
                        <View style={styles.statsCell}>
                          <Text style={styles.statsCellValuePrimary}>{intervalLabel}</Text>
                          <Text style={styles.statsCellLabel}>Intervalle</Text>
                        </View>
                      </View>
                    </View>

                    {/* Prochaine révision */}
                    <View style={styles.statsNextReview}>
                      <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.statsNextReviewLabel}>Prochaine révision</Text>
                      <Text style={styles.statsNextReviewValue}>{nextReviewLabel}</Text>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
