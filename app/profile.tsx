// app/profile.tsx
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header avec bouton retour intégré */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </Pressable>
            <View style={styles.titleContainer}>
              <Text style={styles.mainTitle}>Mon Profil</Text>
              <View style={styles.titleUnderline} />
            </View>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.userInfo}>
            Membre depuis {new Date(user?.created_at || '').toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Vos statistiques</Text>
          {loading ? (
            <View style={styles.loadingStats}>
              <Text style={styles.loadingText}>Chargement des statistiques...</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="library" size={24} color="#007AFF" />
                <Text style={styles.statNumber}>{stats.totalCards}</Text>
                <Text style={styles.statLabel}>Cartes créées</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.statNumber}>{stats.cardsReviewed}</Text>
                <Text style={styles.statLabel}>Cartes étudiées</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flame" size={24} color="#FF9500" />
                <Text style={styles.statNumber}>{stats.currentStreak}</Text>
                <Text style={styles.statLabel}>Jours de suite</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trending-up" size={24} color="#FF3B30" />
                <Text style={styles.statNumber}>{stats.successRate}%</Text>
                <Text style={styles.statLabel}>Taux de réussite</Text>
              </View>
            </View>
          )}
        </View>

        {/* Additional Stats */}
        <View style={styles.additionalStatsSection}>
          <View style={styles.additionalStatItem}>
            <Ionicons name="albums" size={20} color="#666" />
            <Text style={styles.additionalStatText}>
              {stats.totalDecks} collection{stats.totalDecks > 1 ? 's' : ''} créée{stats.totalDecks > 1 ? 's' : ''}
            </Text>
          </View>
          
          {stats.cardsReviewed > 0 && (
            <View style={styles.additionalStatItem}>
              <Ionicons name="analytics" size={20} color="#666" />
              <Text style={styles.additionalStatText}>
                {Math.round((stats.cardsReviewed / stats.totalCards) * 100)}% des cartes ont été révisées
              </Text>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          
          <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={24} color="#666" />
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>

          <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={24} color="#666" />
              <Text style={styles.settingText}>Mode sombre</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>

          <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={24} color="#666" />
              <Text style={styles.settingText}>Aide & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>

          <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="information-circle-outline" size={24} color="#666" />
              <Text style={styles.settingText}>À propos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30, // Ajoute un padding en bas pour éviter que le contenu soit coupé
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#007AFF',
    borderRadius: 2,
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  email: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userInfo: {
    fontSize: 14,
    color: '#666',
  },
  statsSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  loadingStats: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
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
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  additionalStatsSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
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
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  settingsSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
    marginHorizontal: 20,
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
});