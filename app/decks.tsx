// app/decks.tsx
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Deck } from '../types/database';
import AddDeckModal from '../components/AddDeckModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function Decks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [editMode, setEditMode] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [editingDeck, setEditingDeck] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  
    const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
      width: '100%',
      maxWidth: 500,
    },
    content: {
      flex: 1,
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
    titleContainer: {
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 10,
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
    addButton: {
      backgroundColor: theme.primary,
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    loadingText: {
      textAlign: 'center',
      fontSize: 18,
      color: theme.textSecondary,
      marginTop: 50,
    },
    listContainer: {
      padding: 20,
    },
    deckCard: {
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 12,
      marginBottom: 15,
      borderLeftWidth: 8,
      flexDirection: 'row',
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
    deckHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      minHeight: 24,
    },
    deckName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
      marginRight: 12,
      lineHeight: 24,
    },
    deckCardCount: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
      marginBottom: 4,
    },
    deckDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 8,
      lineHeight: 20,
    },
    deckDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.textSecondary,
      marginTop: 20,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 10,
      textAlign: 'center',
      lineHeight: 22,
    },
    editButton: {
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
editButtonActive: {
  backgroundColor: theme.primary,
},
statsContainer: {
  paddingHorizontal: 20,
  paddingVertical: 0,
},
statsText: {
  fontSize: 14,
  color: theme.textSecondary,
  fontWeight: '600',
  textAlign: 'center',
},
addButtonContainer: {
  paddingHorizontal: 20,
  paddingVertical: 15,
},
addCollectionButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.success,
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 12,
  gap: 8,
  alignSelf: 'center',
},
addCollectionButtonText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: 'bold',
},
deckContent: {
  flex: 1,
},
deckActions: {
  flexDirection: 'row',
  gap: 8,
},
editDeckButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: `${theme.primary}20`,
  justifyContent: 'center',
  alignItems: 'center',
},
deleteDeckButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: `${theme.error}20`,
  justifyContent: 'center',
  alignItems: 'center',
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
editDeckContainer: {
  backgroundColor: theme.surface,
  borderRadius: 16,
  padding: 24,
  width: '90%',
  maxWidth: 400,
  shadowColor: theme.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 8,
},
editDeckLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: theme.text,
  marginBottom: 12,
},
editDeckInput: {
  backgroundColor: theme.background,
  borderWidth: 2,
  borderColor: theme.primary,
  borderRadius: 12,
  padding: 15,
  fontSize: 16,
  color: theme.text,
  marginBottom: 8,
},
editDeckButtons: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 16,
},
cancelButton: {
  fontSize: 16,
  color: theme.primary,
},
saveButton: {
  backgroundColor: theme.primary,
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
},
saveButtonDisabled: {
  backgroundColor: isDark ? '#404040' : '#ccc',
},
saveButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
saveButtonTextDisabled: {
  color: isDark ? '#888' : '#999',
},
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
confirmButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#fff',
},
confirmButtonTextDisabled: {
  color: theme.textSecondary,
},
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
toastText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '500',
  textAlign: 'center',
},
  });

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDecks();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      fetchDecks();
    }
  }, [user]);

  useEffect(() => {
  if (toast.visible) {
    const timer = setTimeout(() => {
      setToast({ ...toast, visible: false });
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [toast.visible]);

  async function fetchDecks() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('decks')
        .select('*, cards(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Erreur', 'Impossible de charger les decks');
      } else {
        setDecks(data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  setToast({ visible: true, message, type });
};

const handleUpdateDeck = async () => {
  const trimmedName = newDeckName.trim();
  const trimmedDescription = newDeckDescription.trim();

  if (!trimmedName) {
    Alert.alert('Erreur', 'Le nom ne peut pas être vide');
    return;
  }

  if (trimmedName.length > 50) {
    Alert.alert('Erreur', 'Le nom ne peut pas dépasser 50 caractères');
    return;
  }

  if (!selectedDeck || !user) {
    Alert.alert('Erreur', 'Impossible de modifier la collection');
    return;
  }

  setEditingDeck(true);

  try {
    const { error } = await supabase
      .from('decks')
      .update({ name: trimmedName, description: trimmedDescription || null })
      .eq('id', selectedDeck.id)
      .eq('user_id', user.id);

    if (error) throw error;

    setShowEditDeckModal(false);
    showToast('Collection modifiée avec succès !', 'success');
    fetchDecks();
  } catch (error: any) {
    Alert.alert('Erreur', error.message || 'Impossible de modifier la collection');
  } finally {
    setEditingDeck(false);
  }
};

const handleDeleteDeck = async () => {
  if (!selectedDeck || !user) {
    Alert.alert('Erreur', 'Impossible de supprimer la collection');
    return;
  }

  setDeletingDeck(true);

  try {
    // Supprimer d'abord toutes les cartes
    const { error: cardsError } = await supabase
      .from('cards')
      .delete()
      .eq('deck_id', selectedDeck.id);

    if (cardsError) throw cardsError;

    // Puis supprimer le deck
    const { error: deckError } = await supabase
      .from('decks')
      .delete()
      .eq('id', selectedDeck.id)
      .eq('user_id', user.id);

    if (deckError) throw deckError;

    setShowDeleteConfirm(false);
    showToast('Collection supprimée avec succès !', 'success');
    fetchDecks();
  } catch (error: any) {
    Alert.alert('Erreur', error.message || 'Impossible de supprimer la collection');
  } finally {
    setDeletingDeck(false);
  }
};

  const handleDeckAdded = () => {
    fetchDecks(); // Recharger la liste des decks
    setShowAddModal(false);
  };

  const renderDeck = ({ item }: { item: Deck }) => (
  <Pressable 
    style={[
      styles.deckCard,
      { borderLeftColor: item.color || '#007AFF' }
    ]}
    onPress={() => {
      if (!editMode) {
        router.push(`/deck/${item.id}`);
      }
    }}
    disabled={editMode}
  >
    <View style={styles.deckContent}>
      <Text
        style={styles.deckName}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {item.name}
      </Text>
      <Text style={styles.deckCardCount}>
        {(() => { const count = (item as any).cards?.[0]?.count ?? 0; return `${count} carte${count > 1 ? 's' : ''}`; })()}
      </Text>
      {item.description && (
        <Text style={styles.deckDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </View>
    
    <View style={[styles.deckActions, { opacity: editMode ? 1 : 0 }]}>
      <Pressable 
        style={styles.editDeckButton}
        onPress={(e) => {
          if (editMode) {
            setSelectedDeck(item);
            setNewDeckName(item.name);
            setNewDeckDescription(item.description || '');
            setShowEditDeckModal(true);
          }
        }}
        disabled={!editMode}
      >
        <Ionicons name="pencil" size={18} color="#007AFF" />
      </Pressable>
      <Pressable 
        style={styles.deleteDeckButton}
        onPress={(e) => {
          if (editMode) {
            setSelectedDeck(item);
            setShowDeleteConfirm(true);
          }
        }}
        disabled={!editMode}
      >
        <Ionicons name="trash" size={18} color="#FF3B30" />
      </Pressable>
    </View>
  </Pressable>
);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.mainContent}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.content}>
          {/* Header avec bouton retour intégré */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={theme.primary} />
              </Pressable>
              <View style={styles.titleContainer}>
                <Text style={styles.mainTitle}>Mes Collections</Text>
                <View style={styles.titleUnderline} />
              </View>
              <Pressable 
                style={[styles.editButton, editMode && styles.editButtonActive]} 
                onPress={() => setEditMode(!editMode)}
              >
                <Ionicons 
                  name={editMode ? "checkmark" : "color-wand-outline"} 
                  size={24} 
                  color={editMode ? "#fff" : theme.primary}
                  style={editMode ? {} : { transform: [{ scaleX: -1 }] }}
                />
              </Pressable>
            </View>
          </View>

          {/* Stats */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                {decks.length} collection{decks.length > 1 ? 's' : ''}
              </Text>
            </View>

            {/* Bouton ajouter */}
{!editMode && (
  <View style={styles.addButtonContainer}>
    <Pressable 
      style={styles.addCollectionButton}
      onPress={() => setShowAddModal(true)}
    >
      <Ionicons name="add" size={24} color="#fff" />
      <Text style={styles.addCollectionButtonText}>Ajouter une collection</Text>
    </Pressable>
  </View>
)}

          {decks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={80} color={theme.textSecondary} />
              <Text style={styles.emptyText}>Aucune collection trouvée</Text>
              <Text style={styles.emptySubtext}>
                Créez-en une pour commencer !
              </Text>
            </View>
          ) : (
            <FlatList
              data={decks}
              renderItem={renderDeck}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}       
            />
          )}
        </View>

        {/* Modal d'ajout de deck */}
        <AddDeckModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onDeckAdded={handleDeckAdded}
        />
      </View>

      {/* Toast */}
{toast.visible && (
  <View style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
    <Ionicons 
      name={toast.type === 'success' ? 'checkmark-circle' : 'close-circle'} 
      size={20} 
      color="#fff"
    />
    <Text style={styles.toastText}>{toast.message}</Text>
  </View>
)}

{/* Modal de modification du nom */}
<Modal
  visible={showEditDeckModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowEditDeckModal(false)}
>
  <Pressable 
    style={styles.modalOverlay}
    onPress={() => setShowEditDeckModal(false)}
  >
    <Pressable
      style={styles.editDeckContainer}
      onPress={() => {}}
    >
      <Text style={styles.editDeckLabel}>Nom</Text>
      <TextInput
        style={[styles.editDeckInput, { outlineWidth: 0, borderColor: theme.primary }]}
        value={newDeckName}
        onChangeText={setNewDeckName}
        autoFocus
        maxLength={100}
        placeholder="Nom de la collection"
        selectionColor="#007AFF"
        underlineColorAndroid="transparent"
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        {newDeckName.length > 50 && (
          <Text style={{ fontSize: 12, color: '#E53E3E', fontWeight: '500' }}>
            ⚠️ Max 50 caractères
          </Text>
        )}
        <Text style={{ fontSize: 12, color: newDeckName.length > 50 ? '#E53E3E' : theme.textSecondary, marginLeft: 'auto' }}>
          {newDeckName.length}/50
        </Text>
      </View>
      <Text style={styles.editDeckLabel}>Description (optionnelle)</Text>
      <TextInput
        style={[styles.editDeckInput, { outlineWidth: 0, borderColor: theme.border, minHeight: 80, textAlignVertical: 'top' }]}
        value={newDeckDescription}
        onChangeText={setNewDeckDescription}
        placeholder="Description de la collection"
        selectionColor="#007AFF"
        underlineColorAndroid="transparent"
        multiline
        maxLength={200}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
          {newDeckDescription.length}/200
        </Text>
      </View>
      <View style={styles.editDeckButtons}>
        <Pressable onPress={() => setShowEditDeckModal(false)}>
          <Text style={styles.cancelButton}>Annuler</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (editingDeck || !newDeckName.trim() || newDeckName.length > 50) return;
            handleUpdateDeck();
          }}
          style={[
            styles.saveButton,
            (editingDeck || !newDeckName.trim() || newDeckName.length > 50) && styles.saveButtonDisabled
          ]}
        >
          <Text style={[
            styles.saveButtonText,
            (editingDeck || !newDeckName.trim() || newDeckName.length > 50) && styles.saveButtonTextDisabled
          ]}>
            {editingDeck ? 'Modification...' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  </Pressable>
</Modal>

{/* Modal de confirmation de suppression */}
<Modal
  visible={showDeleteConfirm}
  animationType="fade"
  transparent={true}
  onRequestClose={() => setShowDeleteConfirm(false)}
>
  <View style={styles.confirmOverlay}>
    <View style={styles.confirmModal}>
      <Text style={styles.confirmTitle}>Supprimer la collection</Text>
      <Text style={styles.confirmMessage}>
        Êtes-vous sûr de vouloir supprimer "{selectedDeck?.name}" ? Cette action supprimera également toutes les cartes et ne peut pas être annulée.
      </Text>
      
      <View style={styles.confirmButtons}>
        <Pressable 
          style={[styles.confirmButton, styles.cancelConfirmButton]} 
          onPress={() => setShowDeleteConfirm(false)}
          disabled={deletingDeck}
        >
          <Text style={styles.cancelConfirmText}>Annuler</Text>
        </Pressable>
        
        <Pressable 
          style={[
            styles.confirmButton, 
            { backgroundColor: '#FF3B30' }, 
            deletingDeck && styles.confirmButtonDisabled
          ]} 
          onPress={handleDeleteDeck}
          disabled={deletingDeck}
        >
          <Text style={[
            styles.confirmButtonText, 
            deletingDeck && styles.confirmButtonTextDisabled
          ]}>
            {deletingDeck ? 'Suppression...' : 'Supprimer'}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
    </SafeAreaView>
  );
}