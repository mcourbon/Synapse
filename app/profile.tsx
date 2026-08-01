// app/profile.tsx
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useStats } from '../contexts/StatsContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { StatsTracker } from '../lib/statsTracker';
import { AvatarUpload } from '../lib/avatarUpload';
import { Image } from 'react-native';
import InfoModal from '../components/InfoModal';
import StatTile from '../components/StatTile';
import ConfirmModal from '../components/ConfirmModal';
import ImportCsvModal from '../components/ImportCsvModal';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { stats, userProfile, avatarUrl, setAvatarUrl, setUserProfile, refreshStats } = useStats();
  const router = useRouter();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const usernameInputRef = useRef<TextInput>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Focus sur l'input quand on commence à éditer
  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
    }
  }, [isEditingUsername]);

const handleChangeAvatar = async () => {
  if (!user) return;

  if ((user as any).isGuest) {
    Alert.alert('Indisponible en mode invité', 'La photo de profil nécessite un vrai compte. Créez un compte pour en profiter.');
    return;
  }

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
    
  } catch (error: any) {
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
  } catch {
  }
};

const handleDeleteAccount = () => {
  setShowDeleteAccountModal(true);
};

const confirmDeleteAccount = async () => {
  setDeletingAccount(true);
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
    setShowDeleteAccountModal(false);
    await signOut();
  } catch (error: any) {
    Alert.alert('Erreur', error.message || 'Impossible de supprimer le compte. Réessayez plus tard.');
  } finally {
    setDeletingAccount(false);
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
      Alert.alert('Erreur', 'Impossible de mettre à jour le pseudo');
    } else {
      setUserProfile(prev => prev ? {...prev, username: newUsername.trim()} : null);
      setIsEditingUsername(false);
    }
  } catch {
    Alert.alert('Erreur', 'Une erreur est survenue');
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
    deleteAccountButton: {
      alignItems: 'center',
      marginTop: 16,
      marginHorizontal: 20,
    },
    deleteAccountText: {
      fontSize: 14,
      color: theme.textSecondary,
      textDecorationLine: 'underline',
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
    
    {!(user as any)?.isGuest && (
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
    )}
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
            
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <Text style={dynamicStyles.sectionTitle}>Vos statistiques</Text>
            <View style={styles.statsGrid}>
              {/* Temps d'étude total */}
              <StatTile
                icon="time-outline"
                iconColor={theme.primary}
                textColor="#3B82F6"
                value={StatsTracker.formatStudyTime(stats.totalStudyTime)}
                label="Temps d'étude"
              />

              {/* Meilleure streak */}
              <StatTile
                icon="trophy-outline"
                iconColor={theme.accent}
                textColor="#F59E0B"
                value={stats.longestStreak}
                label="Record de jours"
              />

              {/* Cartes maîtrisées */}
              <StatTile
                icon="star"
                iconColor={theme.success}
                textColor="#10B981"
                value={stats.cardsMastered}
                label="Cartes maîtrisées"
              />

              {/* Plus longue streak de réussites */}
              <StatTile
                icon="flame"
                iconColor="#FF9500"
                textColor="#FF9500"
                value={stats.bestAnswerStreak}
                label="Plus longue streak"
              />

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
              onPress={() => setShowImportModal(true)}>
              <View style={styles.settingLeft}>
                <Ionicons name="cloud-upload-outline" size={24} color={theme.textSecondary} />
                <Text style={dynamicStyles.settingText}>Importer des cartes (CSV)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>

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
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Text style={dynamicStyles.userInfo}>{user?.email}</Text>
            <Text style={dynamicStyles.userInfo}>
              Membre depuis {new Date(user?.created_at || '').toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <Pressable style={dynamicStyles.logoutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
            <Text style={dynamicStyles.logoutText}>Se déconnecter</Text>
          </Pressable>

          {!(user as any)?.isGuest && (
            <Pressable style={dynamicStyles.deleteAccountButton} onPress={handleDeleteAccount}>
              <Text style={dynamicStyles.deleteAccountText}>Supprimer mon compte</Text>
            </Pressable>
          )}
        </ScrollView>

          {/* Notifications Modal */}
          <InfoModal
            visible={showNotificationsModal}
            onClose={() => setShowNotificationsModal(false)}
            title="Notifications"
            icon="notifications-off"
            iconColor={theme.textSecondary}
          >
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
          </InfoModal>

          {/* About Modal */}
          <InfoModal
            visible={showAboutModal}
            onClose={() => setShowAboutModal(false)}
            title="À propos de l'application"
            icon="code-slash"
            iconColor={theme.primary}
          >
            <Text style={dynamicStyles.modalSectionTitle}>Une aventure personnelle</Text>
            <Text style={dynamicStyles.modalText}>
              Cette application est née d'un besoin simple : trouver un outil de révision par cartes (flashcards) qui soit à la fois simple, efficace et addictif à utiliser. Frustré par les options existantes, j'ai décidé de mettre à profit mes compétences pour créer la solution que j'avais en tête.
            </Text>
            <Text style={dynamicStyles.modalText}>
              Chaque fonctionnalité a été pensée pour optimiser l'apprentissage et la mémorisation, en se basant sur des principes comme la répétition espacée.
            </Text>
            <Pressable
              onPress={() => {
                setShowAboutModal(false);
                router.push('/politique-de-confidentialite');
              }}
            >
              <Text style={[dynamicStyles.modalText, { color: theme.primary, fontWeight: '600' }]}>
                Politique de confidentialité
              </Text>
            </Pressable>
            <Text style={dynamicStyles.versionText}>Version 1.0.0</Text>
          </InfoModal>

          {/* Help & Support Modal */}
          <InfoModal
            visible={showHelpModal}
            onClose={() => setShowHelpModal(false)}
            title="Aide & Support"
            icon="help-circle"
            iconColor={theme.success}
          >
            <Text style={dynamicStyles.modalSectionTitle}>Votre avis compte</Text>
            <Text style={dynamicStyles.modalText}>
              Ce projet est en constante évolution. Si vous avez des idées, des suggestions ou si vous rencontrez un bug, n'hésitez pas à me contacter. Votre retour est précieux pour améliorer l'application.
            </Text>

            <Pressable
              style={dynamicStyles.contactButton}
              onPress={() => {
                setShowHelpModal(false);
                Linking.openURL('mailto:synapse.contact.app@gmail.com?subject=Feedback sur Synapse');
              }}
            >
              <Text style={styles.contactButtonText}>Donner mon avis</Text>
            </Pressable>

            <Text style={dynamicStyles.versionText}>Vous pouvez également nous contacter pour toute autre question.</Text>
          </InfoModal>

          {/* Logout Modal */}
          <ConfirmModal
            visible={showLogoutModal}
            title="Déconnexion"
            message="Voulez-vous vraiment vous déconnecter ?"
            onConfirm={confirmLogout}
            onCancel={() => setShowLogoutModal(false)}
            confirmText="Déconnexion"
            cancelText="Annuler"
            confirmColor={theme.error}
          />

          {/* Delete Account Modal */}
          <ConfirmModal
            visible={showDeleteAccountModal}
            title="Supprimer le compte"
            message="Cette action est irréversible : votre compte, vos collections, vos cartes et vos statistiques seront définitivement supprimés."
            onConfirm={confirmDeleteAccount}
            onCancel={() => setShowDeleteAccountModal(false)}
            confirmText="Supprimer définitivement"
            cancelText="Annuler"
            confirmColor={theme.error}
            isLoading={deletingAccount}
          />

          {/* Import CSV Modal */}
          <ImportCsvModal
            visible={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImported={(deckName, count) => {
              refreshStats();
              Alert.alert('Import réussi', `${count} carte${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} à « ${deckName} ».`);
            }}
          />
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
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
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
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});