// app/profile.tsx
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch, Modal, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext'; // Ajouter cet import
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { StatsTracker } from '../lib/statsTracker';
import { AvatarUpload } from '../lib/avatarUpload';
import { Image } from 'react-native';

interface UserStats {
  // Stats de base
  totalCards: number;
  totalDecks: number;
  cardsReviewed: number;
  
  // Stats de streak
  currentStreak: number;
  longestStreak: number;
  
  // Stats de révision
  totalReviews: number;
  successRate: number;
  hardReviews: number;
  mediumReviews: number;
  easyReviews: number;
  
  // Stats de temps
  totalStudyTime: number;
  
  // Stats de difficulté
  cardsMastered: number;
  cardsDifficult: number;
  
  // Historique
  studyDays: string[];
}

interface UserProfile {
  id: string;
  username: string | null;
  email: string;
  created_at: string;
  avatar_url?: string | null;
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
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const usernameInputRef = useRef<TextInput>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);


  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  // Focus sur l'input quand on commence à éditer
  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
    }
  }, [isEditingUsername]);

  const fetchUserStats = async () => {
  if (!user) return;

  try {
    // 1. Récupérer les stats trackées automatiquement
    const userStats = await StatsTracker.getUserStats(user.id);
    
    // 2. Récupérer les stats "live" (nombre de cartes, decks)
    const liveStats = await StatsTracker.getLiveStats(user.id);

    // 3. Mettre à jour les stats de difficulté des cartes
    await StatsTracker.updateCardDifficultyStats(user.id);

    // 4. Récupérer le profil utilisateur
    if (userStats) {
  setUserProfile({
    id: userStats.user_id,
    username: userStats.username,
    email: user.email || '',
    created_at: user.created_at || '',
    avatar_url: userStats.avatar_url, // ⭐ AJOUTE ÇA
  });
  setNewUsername(userStats.username || '');
  setAvatarUrl(userStats.avatar_url || null); // ⭐ ET ÇA
}

    // 5. Calculer le taux de réussite
    const successRate = StatsTracker.calculateSuccessRate(userStats);

    // 6. Mettre à jour l'état avec toutes les stats
    setStats({
      totalCards: liveStats.totalCards,
      totalDecks: liveStats.totalDecks,
      cardsReviewed: liveStats.cardsReviewed,
      currentStreak: userStats?.current_streak || 0,
      successRate: successRate,
      // Nouvelles stats disponibles :
      longestStreak: userStats?.longest_streak || 0,
      totalReviews: userStats?.total_reviews || 0,
      hardReviews: userStats?.hard_reviews || 0,
      mediumReviews: userStats?.medium_reviews || 0,
      easyReviews: userStats?.easy_reviews || 0,
      totalStudyTime: userStats?.total_study_time || 0,
      cardsMastered: userStats?.cards_mastered || 0,
      cardsDifficult: userStats?.cards_difficult || 0,
      studyDays: userStats?.study_days || [],
    });

  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
  } finally {
    setLoading(false);
  }
};

const handleChangeAvatar = async () => {
  if (!user) return;

  console.log('👤 User ID:', user.id); // ← Ajoute ça
  
  try {
    setUploadingAvatar(true);
    
    // Sélectionner l'image
    const imageAsset = await AvatarUpload.pickImage();
    if (!imageAsset) {
      setUploadingAvatar(false);
      return; // L'utilisateur a annulé
    }

    // Upload et mise à jour
    const newAvatarUrl = await AvatarUpload.updateUserAvatar(user.id, imageAsset);
    
    // Mettre à jour l'état local
    setAvatarUrl(newAvatarUrl);
    setUserProfile(prev => prev ? {...prev, avatar_url: newAvatarUrl} : null);
    
    console.log('✅ Avatar mis à jour avec succès');
  } catch (error: any) {
    console.error('Erreur changement avatar:', error);
    if (error.message === 'Permission refusée pour accéder à la galerie') {
      Alert.alert(
        'Permission requise',
        'Veuillez autoriser l\'accès à vos photos dans les paramètres de votre téléphone.'
      );
    } else {
      Alert.alert('Erreur', 'Impossible de changer la photo de profil');
    }
  } finally {
    setUploadingAvatar(false);
  }
};

const handleSignOut = () => {
  setShowLogoutModal(true);
};

const confirmLogout = async () => {
  setShowLogoutModal(false);
  try {
    await signOut();
  } catch (error) {
    console.error('Erreur:', error);
  }
};

const startEditingUsername = () => {
  setIsEditingUsername(true);
  setNewUsername(userProfile?.username || '');
};

const cancelEditingUsername = () => {
  setIsEditingUsername(false);
  setNewUsername(userProfile?.username || '');
};

const updateUsername = async () => {
  if (!user || !newUsername.trim()) {
    cancelEditingUsername();
    return;
  }
  
  setIsUpdatingUsername(true);
  try {
    const { error } = await supabase
      .from('user_stats')
      .update({
        username: newUsername.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Erreur mise à jour username:', error);
      console.log('Erreur', 'Impossible de mettre à jour le pseudo');
    } else {
      // Mettre à jour l'état local
      setUserProfile(prev => prev ? {...prev, username: newUsername.trim()} : null);
      setIsEditingUsername(false);
      console.log('Succès', 'Pseudo mis à jour avec succès !');
    }
  } catch (error) {
    console.error('Erreur:', error);
    console.log('Erreur', 'Une erreur est survenue');
  } finally {
    setIsUpdatingUsername(false);
  }
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
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadow,
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
    invisibleIcon: {
      marginRight: 8,
      padding: 6,
      borderRadius: 8,
    },
    usernameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
      minHeight: 40,
    },
    usernameText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    usernameInput: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.primary,
      minWidth: 200,
      textAlign: 'center',
    },
    editButton: {
      marginLeft: 8,
      padding: 6,
      borderRadius: 8,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
      gap: 4,
    },
    saveButton: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: theme.success,
      shadowColor: theme.success,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    cancelButton: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
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
modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 0,
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
  modalSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  modalText: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 32,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: theme.textSecondary,
    opacity: 0.6,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  notificationInfoContainer: {
    backgroundColor: theme.warning + '15',
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.warning,
    marginBottom: 20,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationInfoText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
    fullWidthCard: {
    backgroundColor: theme.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 5,
  },
  avatarContainer: {
  position: 'relative',
  marginBottom: 15,
},
avatarImage: {
  width: 80,
  height: 80,
  borderRadius: 40,
},
avatarEditButton: {
  position: 'absolute',
  bottom: 0,
  right: -5,
  backgroundColor: theme.primary,
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: theme.background,
  shadowColor: theme.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
avatarPlaceholder: {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: theme.primary,
  justifyContent: 'center',
  alignItems: 'center',
},
statValue: {
  fontSize: 24,
  fontWeight: 'bold',
  color: theme.text,
  marginTop: 8,
  marginBottom: 4,
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
  <View style={dynamicStyles.avatarContainer}>
    {avatarUrl ? (
      <Image 
        source={{ uri: avatarUrl }}
        style={dynamicStyles.avatarImage}
      />
    ) : (
      <View style={dynamicStyles.avatarPlaceholder}>
        <Ionicons name="person" size={40} color="#fff" />
      </View>
    )}
    
    <Pressable 
      style={dynamicStyles.avatarEditButton}
      onPress={handleChangeAvatar}
      disabled={uploadingAvatar}
    >
      {uploadingAvatar ? (
        <Ionicons name="hourglass" size={16} color="#fff" />
      ) : (
        <Ionicons name="camera" size={16} color="#fff" />
      )}
    </Pressable>
  </View>
            
            {/* Username avec édition inline */}
            <View style={dynamicStyles.usernameContainer}>
  {isEditingUsername ? (
    <>
      <TextInput
        ref={usernameInputRef}
        style={[
          dynamicStyles.usernameInput,
          { outlineWidth: 0 }
        ]}
        value={newUsername}
        onChangeText={setNewUsername}
        placeholder="Votre pseudo"
        placeholderTextColor={theme.textSecondary}
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={updateUsername}
        editable={!isUpdatingUsername}
      />
      <View style={dynamicStyles.actionButtonsContainer}>
        <Pressable 
          style={dynamicStyles.saveButton} 
          onPress={updateUsername}
          disabled={isUpdatingUsername || !newUsername.trim()}
        >
          <Ionicons 
            name={"checkmark"} 
            size={16} 
            color="#fff" 
          />
        </Pressable>
        <Pressable 
          style={dynamicStyles.cancelButton} 
          onPress={cancelEditingUsername}
          disabled={isUpdatingUsername}
        >
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
    </>
  ) : (
    <>
      {/* Icône invisible pour équilibrer */}
      <View style={dynamicStyles.invisibleIcon}>
        <Ionicons name="pencil" size={16} color="transparent" />
      </View>
      
      <Text style={dynamicStyles.usernameText}>
        {userProfile?.username || 'Utilisateur anonyme'}
      </Text>
      
      <Pressable style={dynamicStyles.editButton} onPress={startEditingUsername}>
        <Ionicons name="pencil" size={16} color={theme.textSecondary} />
      </Pressable>
    </>
  )}
</View>
            
            <Text style={dynamicStyles.userInfo}>
              {user?.email}
            </Text>
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
                {/* Temps d'étude total */}
<View style={dynamicStyles.statCard}>
  <Ionicons name="time-outline" size={20} color={theme.primary} />
  <Text style={styles.statValueBlue}>
    {StatsTracker.formatStudyTime(stats.totalStudyTime)}
  </Text>
  <Text style={styles.statLabelBlue}>Temps d'étude</Text>
</View>

{/* Meilleure streak */}
<View style={dynamicStyles.statCard}>
  <Ionicons name="trophy-outline" size={20} color={theme.accent} />
  <Text style={styles.statValueYellow}>{stats.longestStreak}</Text>
  <Text style={styles.statLabelYellow}>Record de jours</Text>
</View>

{/* Cartes maîtrisées */}
<View style={dynamicStyles.statCard}>
  <Ionicons name="star" size={20} color={theme.success} />
  <Text style={styles.statValueGreen}>{stats.cardsMastered}</Text>
  <Text style={styles.statLabelGreen}>Cartes maîtrisées</Text>
</View>

{/* Cartes difficiles */}
<View style={dynamicStyles.statCard}>
  <Ionicons name="alert-circle" size={20} color={theme.error} />
  <Text style={styles.statValueRed}>{stats.cardsDifficult}</Text>
  <Text style={styles.statLabelRed}>Cartes difficiles</Text>
</View>

{/* Répartition des réponses */}
<View style={dynamicStyles.fullWidthCard}>
  <Text style={dynamicStyles.statSectionTitle}>Répartition des réponses</Text>
  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.error }}>
        {stats.hardReviews}
      </Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>Difficile</Text>
    </View>
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.warning }}>
        {stats.mediumReviews}
      </Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>Moyen</Text>
    </View>
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.success }}>
        {stats.easyReviews}
      </Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>Facile</Text>
    </View>
  </View>
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
            
            <Pressable 
              style={dynamicStyles.settingItem}
              onPress={() => setShowNotificationsModal(true)}>
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

            <Pressable 
              style={dynamicStyles.settingItem}
              onPress={() => setShowHelpModal(true)}>
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} />
                <Text style={dynamicStyles.settingText}>Aide & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable 
              style={dynamicStyles.settingItem}  
              onPress={() => setShowAboutModal(true)}>
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

          {/* Notifications Modal */}
        <Modal
          visible={showNotificationsModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowNotificationsModal(false)}
        >
          <Pressable 
            style={dynamicStyles.modalOverlay}
            onPress={() => setShowNotificationsModal(false)}
            activeOpacity={1}
          >
            <Pressable 
              style={dynamicStyles.modalContent}
              onPress={() => {}} // Empêche la fermeture quand on clique dans la modale
              activeOpacity={1}
            >
              {/* Header de la modale */}
              <View style={dynamicStyles.modalHeader}>
                <View style={{width: 36}} /> 
                <Text style={dynamicStyles.modalTitle}>Notifications</Text>
                <Pressable onPress={() => setShowNotificationsModal(false)} style={dynamicStyles.closeButtonCircle}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={dynamicStyles.modalIconContainer}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.textSecondary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <Ionicons name="notifications-off" size={36} color={theme.textSecondary} />
                </View>
              </View>

              <Text style={dynamicStyles.modalSectionTitle}>Fonctionnalité à venir</Text>
              
              <View style={dynamicStyles.notificationInfoContainer}>
                <Text style={dynamicStyles.notificationInfoText}>
                  Les notifications ne sont pas encore disponibles dans cette version de l'application.
                </Text>
              </View>

              <Text style={dynamicStyles.modalText}>
                Cette fonctionnalité est en cours de développement et sera bientôt disponible pour vous rappeler vos sessions de révision et vous aider à maintenir votre routine d'apprentissage.
              </Text>

              <Text style={dynamicStyles.modalText}>
                En attendant, nous vous encourageons à créer votre propre routine de révision pour maximiser vos résultats !
              </Text>
            </Pressable>
          </Pressable>
        </Modal>

          {/* About Modal */}
        <Modal
          visible={showAboutModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowAboutModal(false)}
        >
          <Pressable 
            style={dynamicStyles.modalOverlay}
            onPress={() => setShowAboutModal(false)}
            activeOpacity={1}
          >
            <Pressable 
              style={dynamicStyles.modalContent}
              onPress={() => {}}
              activeOpacity={1}
            >
              {/* Header de la modale */}
              <View style={dynamicStyles.modalHeader}>
                <View style={{width: 36}} /> 
                <Text style={dynamicStyles.modalTitle}>À propos de l'application</Text>
                <Pressable onPress={() => setShowAboutModal(false)} style={dynamicStyles.closeButtonCircle}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
                <View style={dynamicStyles.modalIconContainer}>
                  <View style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: theme.primary + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="code-slash" size={36} color={theme.primary} />
                  </View>
                </View>

                <Text style={dynamicStyles.modalSectionTitle}>Une aventure personnelle</Text>
                <Text style={dynamicStyles.modalText}>
                  Cette application est née d'un besoin simple : trouver un outil de révision par cartes (flashcards) qui soit à la fois simple, efficace et addictif à utiliser. Frustré par les options existantes, j'ai décidé de mettre à profit mes compétences pour créer la solution que j'avais en tête.
                </Text>
                <Text style={dynamicStyles.modalText}>
                  Chaque fonctionnalité a été pensée pour optimiser l'apprentissage et la mémorisation, en se basant sur des principes comme la répétition espacée.
                </Text>
                <Text style={dynamicStyles.versionText}>Version 1.0.0</Text>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Help & Support Modal */}
        <Modal
          visible={showHelpModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowHelpModal(false)}
        >
          <Pressable 
            style={dynamicStyles.modalOverlay}
            onPress={() => setShowHelpModal(false)}
            activeOpacity={1}
          >
            <Pressable 
              style={dynamicStyles.modalContent}
              onPress={() => {}}
              activeOpacity={1}
            >
              <View style={dynamicStyles.modalHeader}>
                <View style={{width: 36}} /> 
                <Text style={dynamicStyles.modalTitle}>Aide & Support</Text>
                <Pressable onPress={() => setShowHelpModal(false)} style={dynamicStyles.closeButtonCircle}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
                <View style={dynamicStyles.modalIconContainer}>
                  <View style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: theme.success + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="help-circle" size={36} color={theme.success} />
                  </View>
                </View>

                <Text style={dynamicStyles.modalSectionTitle}>Votre avis compte</Text>
                <Text style={dynamicStyles.modalText}>
                  Ce projet est en constante évolution. Si vous avez des idées, des suggestions ou si vous rencontrez un bug, n'hésitez pas à me contacter. Votre retour est précieux pour améliorer l'application.
                </Text>
                
                <Pressable 
                  style={dynamicStyles.contactButton}
                  onPress={() => {
                    setShowHelpModal(false);
                    Linking.openURL('mailto:votre.email@example.com?subject=Feedback sur l\'application Flashcards');
                  }}
                >
                  <Text style={dynamicStyles.contactButtonText}>Donner mon avis</Text>
                </Pressable>

                <Text style={dynamicStyles.versionText}>Vous pouvez également nous contacter pour toute autre question.</Text>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Logout Modal */}
        <Modal
          visible={showLogoutModal}
          transparent={true}
          animationType="fade"
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: theme.surface, padding: 20, borderRadius: 12, margin: 20 }}>
              <Text style={{ color: theme.text, marginBottom: 20 }}>Voulez-vous vraiment vous déconnecter ?</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <Pressable onPress={() => setShowLogoutModal(false)}>
                  <Text style={{ color: theme.textSecondary, padding: 10 }}>Annuler</Text>
                </Pressable>
                <Pressable onPress={confirmLogout}>
                  <Text style={{ color: theme.error, padding: 10 }}>Déconnexion</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  statValueBlue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginTop: 8,
    marginBottom: 4,
  },
  statValueYellow: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginTop: 8,
    marginBottom: 4,
  },
  statValueGreen: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 8,
    marginBottom: 4,
  },
  statValueRed: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabelBlue: {
    fontSize: 12,
    color: '#3B82F6',
    textAlign: 'center',
    fontWeight: '600',
  },
  statLabelYellow: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    fontWeight: '600',
  },
  statLabelGreen: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'center',
    fontWeight: '600',
  },
  statLabelRed: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
});