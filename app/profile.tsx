// app/profile.tsx
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext'; // Ajouter cet import
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserStats {
  totalCards: number;
  totalDecks: number;
  cardsReviewed: number;
  currentStreak: number;
  successRate: number;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme(); // Utiliser le contexte theme
  const router = useRouter();
  const [stats, setStats] = useState<UserStats>({
    totalCards: 0,
    totalDecks: 0,
    cardsReviewed: 0,
    currentStreak: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      // Récupérer le nombre de decks
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('id')
        .eq('user_id', user.id);

      if (decksError) {
        console.error('Erreur decks:', decksError);
      }

      // Récupérer toutes les cartes de l'utilisateur avec leurs statistiques
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select(`
          id,
          repetitions,
          ease_factor,
          last_reviewed,
          decks!inner(user_id)
        `)
        .eq('decks.user_id', user.id);

      if (cardsError) {
        console.error('Erreur cartes:', cardsError);
      }

      // Calculer les statistiques
      const totalDecks = decksData?.length || 0;
      const totalCards = cardsData?.length || 0;
      
      // Calculer le nombre de cartes révisées (au moins une fois)
      const cardsReviewed = cardsData?.filter(card => 
        card.repetitions && card.repetitions > 0
      ).length || 0;

      // Calculer le taux de réussite basé sur l'ease_factor
      // ease_factor commence à 2.5, augmente si facile/moyen, diminue si difficile
      let totalSuccessScore = 0;
      let reviewedCards = 0;

      cardsData?.forEach(card => {
        if (card.repetitions && card.repetitions > 0) {
          reviewedCards++;
          // Convertir ease_factor en pourcentage de réussite
          // 2.5 = 50%, 3.0 = 75%, 2.0 = 25%, etc.
          const easeFactor = card.ease_factor || 2.5;
          const successScore = Math.min(100, Math.max(0, ((easeFactor - 1.3) / 1.7) * 100));
          totalSuccessScore += successScore;
        }
      });

      const successRate = reviewedCards > 0 
        ? Math.round(totalSuccessScore / reviewedCards)
        : 0;

      // Calculer la streak (jours consécutifs)
      // Pour l'instant, on utilise une logique simple basée sur last_reviewed
      let currentStreak = 0;
      
      if (cardsData && cardsData.length > 0) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Vérifier si l'utilisateur a révisé hier ou aujourd'hui
        const recentReviews = cardsData.filter(card => {
          if (!card.last_reviewed) return false;
          const reviewDate = new Date(card.last_reviewed);
          const daysDiff = Math.floor((today.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 1; // Aujourd'hui ou hier
        });

        if (recentReviews.length > 0) {
          // Calcul simplifié de la streak
          currentStreak = Math.min(7, Math.floor(cardsReviewed / 5)); // Max 7 jours, 1 jour par 5 cartes révisées
        }
      }

      setStats({
        totalCards,
        totalDecks,
        cardsReviewed,
        currentStreak,
        successRate,
      });

    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
          style: 'destructive',
          onPress: signOut
        }
      ]
    );
  };

  // Créer les styles dynamiques avec le thème
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
    mainTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    titleUnderline: {
      width: 60,
      height: 3,
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
    },
    email: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 5,
    },
    userInfo: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 15,
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    additionalStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: 15,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    additionalStatText: {
      fontSize: 14,
      color: theme.text,
      marginLeft: 12,
      fontWeight: '500',
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    settingText: {
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.error,
      gap: 8,
      marginHorizontal: 20,
    },
    logoutText: {
      fontSize: 16,
      color: theme.error,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={styles.mainContent}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header avec bouton retour intégré */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <Pressable style={dynamicStyles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={theme.primary} />
              </Pressable>
              <View style={styles.titleContainer}>
                <Text style={dynamicStyles.mainTitle}>Mon Profil</Text>
                <View style={dynamicStyles.titleUnderline} />
              </View>
              <View style={styles.placeholder} />
            </View>
          </View>

          {/* User Info */}
          <View style={styles.userSection}>
            <View style={dynamicStyles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <Text style={dynamicStyles.email}>{user?.email}</Text>
            <Text style={dynamicStyles.userInfo}>
              Membre depuis {new Date(user?.created_at || '').toLocaleDateString('fr-FR')}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <Text style={dynamicStyles.sectionTitle}>Vos statistiques</Text>
            {loading ? (
              <View style={styles.loadingStats}>
                <Text style={dynamicStyles.loadingText}>Chargement des statistiques...</Text>
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="library" size={24} color={theme.primary} />
                  <Text style={dynamicStyles.statNumber}>{stats.totalCards}</Text>
                  <Text style={dynamicStyles.statLabel}>Cartes créées</Text>
                </View>
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  <Text style={dynamicStyles.statNumber}>{stats.cardsReviewed}</Text>
                  <Text style={dynamicStyles.statLabel}>Cartes étudiées</Text>
                </View>
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="flame" size={24} color={theme.warning} />
                  <Text style={dynamicStyles.statNumber}>{stats.currentStreak}</Text>
                  <Text style={dynamicStyles.statLabel}>Jours de suite</Text>
                </View>
                <View style={dynamicStyles.statCard}>
                  <Ionicons name="trending-up" size={24} color={theme.error} />
                  <Text style={dynamicStyles.statNumber}>{stats.successRate}%</Text>
                  <Text style={dynamicStyles.statLabel}>Taux de réussite</Text>
                </View>
              </View>
            )}
          </View>

          {/* Additional Stats */}
          <View style={styles.additionalStatsSection}>
            <View style={dynamicStyles.additionalStatItem}>
              <Ionicons name="albums" size={20} color={theme.textSecondary} />
              <Text style={dynamicStyles.additionalStatText}>
                {stats.totalDecks} collection{stats.totalDecks > 1 ? 's' : ''} créée{stats.totalDecks > 1 ? 's' : ''}
              </Text>
            </View>
            
            {stats.cardsReviewed > 0 && (
              <View style={dynamicStyles.additionalStatItem}>
                <Ionicons name="analytics" size={20} color={theme.textSecondary} />
                <Text style={dynamicStyles.additionalStatText}>
                  {Math.round((stats.cardsReviewed / stats.totalCards) * 100)}% des cartes ont été révisées
                </Text>
              </View>
            )}
          </View>

          {/* Settings */}
          <View style={styles.settingsSection}>
            <Text style={dynamicStyles.sectionTitle}>Paramètres</Text>
            
            <Pressable style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={24} color={theme.textSecondary} />
                <Text style={dynamicStyles.settingText}>Notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>

            {/* Dark Mode Setting avec Switch */}
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons 
                  name={isDark ? "moon" : "moon-outline"} 
                  size={24} 
                  color={theme.textSecondary} 
                />
                <Text style={dynamicStyles.settingText}>Mode sombre</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={isDark ? '#fff' : '#f4f3f4'}
                ios_backgroundColor={theme.border}
              />
            </View>

            <Pressable style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} />
                <Text style={dynamicStyles.settingText}>Aide & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle-outline" size={24} color={theme.textSecondary} />
                <Text style={dynamicStyles.settingText}>À propos</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Logout */}
          <Pressable style={dynamicStyles.logoutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
            <Text style={dynamicStyles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Styles statiques qui ne changent pas avec le thème
const styles = StyleSheet.create({
  mainContent: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
    marginTop: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  placeholder: {
    width: 48,
    height: 48,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statsSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  loadingStats: {
    padding: 40,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  additionalStatsSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  settingsSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});