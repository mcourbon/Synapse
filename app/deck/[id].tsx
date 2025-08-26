import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card, Deck } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

// Composant Modal de Confirmation Personnalisé
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

const ConfirmModal = ({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmColor = '#FF3B30',
  isLoading = false
}: ConfirmModalProps) => (
  <Modal
    visible={visible}
    animationType="fade"
    transparent={true}
    onRequestClose={onCancel}
  >
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
            <Text style={[styles.confirmButtonText, isLoading && styles.confirmButtonTextDisabled]}>
              {isLoading ? 'Chargement...' : confirmText}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

// Composant Toast personnalisé
interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
  onHide: () => void;
}

const Toast = ({ visible, message, type, onHide }: ToastProps) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <View style={[styles.toast, type === 'success' ? styles.toastSuccess : styles.toastError]}>
      <Ionicons 
        name={type === 'success' ? 'checkmark-circle' : 'close-circle'} 
        size={20} 
        color="#fff" 
      />
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

export default function DeckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteCardConfirm, setShowDeleteCardConfirm] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState(''); // Pour saisir une nouvelle catégorie
  const [addingCard, setAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const router = useRouter();
  const { user } = useAuth();

  // Fonction pour afficher un toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Fonction pour afficher une erreur
  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Fonction pour ajouter une catégorie
  const addCategory = () => {
    if (!newCategory.trim()) return;
    
    const trimmedCategory = newCategory.trim();
    
    // Vérifier la longueur (12 caractères max)
    if (trimmedCategory.length > 12) {
      showError('Les catégories sont limitées à 12 caractères');
      return;
    }
    
    // Vérifier si la catégorie n'existe pas déjà et qu'on ne dépasse pas 3 catégories
    if (!categories.includes(trimmedCategory) && categories.length < 3) {
      setCategories([...categories, trimmedCategory]);
      setNewCategory('');
    } else if (categories.includes(trimmedCategory)) {
      showError('Cette catégorie existe déjà');
    }
  };

  // Fonction pour gérer la saisie de nouvelle catégorie avec limitation
  const handleNewCategoryChange = (text: string) => {
    if (text.length <= 12) {
      setNewCategory(text);
    }
  };

  // Fonction pour supprimer une catégorie
  const removeCategory = (categoryToRemove: string) => {
    setCategories(categories.filter(cat => cat !== categoryToRemove));
  };

  useEffect(() => {
    if (id && user) {
      fetchDeckAndCards();
    }
  }, [id, user]);

  async function fetchDeckAndCards() {
    if (!id || !user) return;

    try {
      // Récupérer les infos du deck
      const { data: deckData, error: deckError } = await supabase
        .from('decks')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (deckError) {
        console.error('Erreur deck:', deckError);
        showError('Impossible de charger le deck');
        router.back();
        return;
      }

      // Récupérer les cartes du deck
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', id)
        .order('created_at', { ascending: false });

      if (cardsError) {
        console.error('Erreur cartes:', cardsError);
        showError('Impossible de charger les cartes');
      } else {
        setCards(cardsData || []);
      }

      setDeck(deckData);
    } catch (err) {
      console.error('Erreur:', err);
      showError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  const handleStartReview = () => {
    if (cards.length === 0) {
      showError('Ce deck ne contient aucune carte à réviser');
      return;
    }
    
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    router.push(`/card/${randomCard.id}`);
  };

  const handleAddCard = async () => {
    if (!front.trim() || !back.trim()) {
      showError('Veuillez remplir le recto et le verso');
      return;
    }

    if (!id || !user) {
      showError('Impossible d\'ajouter la carte');
      return;
    }

    setAddingCard(true);

    try {
      const { error } = await supabase
        .from('cards')
        .insert([
          {
            deck_id: id,
            front: front.trim(),
            back: back.trim(),
            categories: categories.length > 0 ? categories : null,
          }
        ]);

      if (error) {
        throw error;
      }

      setFront('');
      setBack('');
      setCategories([]);
      setNewCategory('');
      setShowAddModal(false);
      
      showToast('Carte ajoutée avec succès !', 'success');
      fetchDeckAndCards();
    } catch (error: any) {
      console.error('Erreur:', error);
      showError(error.message || 'Impossible d\'ajouter la carte');
    } finally {
      setAddingCard(false);
    }
  };

  const handleEditCard = async () => {
    if (!front.trim() || !back.trim()) {
      showError('Veuillez remplir le recto et le verso');
      return;
    }

    if (!selectedCard) {
      showError('Aucune carte sélectionnée');
      return;
    }

    setEditingCard(true);

    try {
      const { error } = await supabase
        .from('cards')
        .update({
          front: front.trim(),
          back: back.trim(),
          categories: categories.length > 0 ? categories : null,
        })
        .eq('id', selectedCard.id);

      if (error) {
        throw error;
      }

      setFront('');
      setBack('');
      setCategories([]);
      setNewCategory('');
      setSelectedCard(null);
      setShowEditCardModal(false);
      
      showToast('Carte modifiée avec succès !', 'success');
      fetchDeckAndCards();
    } catch (error: any) {
      console.error('Erreur:', error);
      showError(error.message || 'Impossible de modifier la carte');
    } finally {
      setEditingCard(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) {
      showError('Aucune carte sélectionnée');
      return;
    }

    setDeletingCard(true);

    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', selectedCard.id);

      if (error) {
        throw error;
      }

      setSelectedCard(null);
      setShowDeleteCardConfirm(false);
      
      showToast('Carte supprimée avec succès !', 'success');
      fetchDeckAndCards();
    } catch (error: any) {
      console.error('Erreur:', error);
      showError(error.message || 'Impossible de supprimer la carte');
    } finally {
      setDeletingCard(false);
    }
  };

  const handleDeleteDeck = () => {
    setShowOptionsModal(false);
    setShowDeleteConfirm(true);
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    setShowOptionsModal(false);
  };

  const confirmDeleteDeck = async () => {
    if (!id || !user) {
      showError('Impossible de supprimer le deck');
      return;
    }

    setDeletingDeck(true);

    try {
      // Supprimer d'abord toutes les cartes du deck
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .eq('deck_id', id);

      if (cardsError) {
        throw cardsError;
      }

      // Puis supprimer le deck
      const { error: deckError } = await supabase
        .from('decks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deckError) {
        throw deckError;
      }

      setShowDeleteConfirm(false);
      showToast('Deck supprimé avec succès !', 'success');
      
      // Attendre un peu avant de naviguer pour que l'utilisateur voie le toast
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('Erreur:', error);
      showError(error.message || 'Impossible de supprimer le deck');
    } finally {
      setDeletingDeck(false);
    }
  };

  const openEditCardModal = (card: Card) => {
    setSelectedCard(card);
    setFront(card.front);
    setBack(card.back);
    setCategories(card.categories || []);
    setNewCategory('');
    setShowEditCardModal(true);
  };

  const openDeleteCardConfirm = (card: Card) => {
    setSelectedCard(card);
    setShowDeleteCardConfirm(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditCardModal(false);
    setFront('');
    setBack('');
    setCategories([]);
    setNewCategory('');
    setSelectedCard(null);
  };

  const renderCard = ({ item }: { item: Card }) => (
    <Pressable 
      style={styles.cardItem}
      onPress={() => {
        if (editMode) {
          // En mode édition, ne pas naviguer vers la carte
          return;
        }
        router.push(`/card/${item.id}`);
      }}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardFront} numberOfLines={2}>
          {item.front}
        </Text>
        <Text style={styles.cardBack} numberOfLines={2}>
          {item.back}
        </Text>
        {item.categories && item.categories.length > 0 && (
          <View style={styles.cardCategoriesContainer}>
            {item.categories.slice(0, 3).map((cat, index) => (
              <Text key={index} style={styles.cardCategory}>
                {cat}
              </Text>
            ))}
            {item.categories.length > 3 && (
              <Text style={styles.cardCategory}>
                +{item.categories.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>
      
      {editMode ? (
        <View style={styles.cardActions}>
          <Pressable 
            style={styles.editButton}
            onPress={() => openEditCardModal(item)}
          >
            <Ionicons name="pencil" size={18} color="#007AFF" />
          </Pressable>
          <Pressable 
            style={styles.deleteButton}
            onPress={() => openDeleteCardConfirm(item)}
          >
            <Ionicons name="trash" size={18} color="#FF3B30" />
          </Pressable>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
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

  if (!deck) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.mainContent}>
          <Text style={styles.errorText}>Deck introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Header */}
        <View style={styles.floatingHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{deck.name}</Text>
        <Pressable 
          style={[styles.optionsButton, editMode && styles.optionsButtonEditMode]} 
          onPress={editMode ? () => setEditMode(false) : () => setShowOptionsModal(true)}
          disabled={deletingDeck}
        >
          <Ionicons 
            name={editMode ? "checkmark" : "ellipsis-horizontal"} 
            size={24} 
            color={editMode ? "#fff" : "#007AFF"} 
          />
        </Pressable>
      </View>

      {/* Informations du deck */}
      <View style={styles.deckInfo}>
        {deck.description && (
          <Text style={styles.deckDescription}>{deck.description}</Text>
        )}
        <Text style={styles.deckStats}>
          {cards.length} carte{cards.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Boutons d'action */}
      {!editMode && (
        <View style={styles.actionButtons}>
          {cards.length > 0 && (
            <Pressable style={styles.reviewButton} onPress={handleStartReview}>
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.reviewButtonText}>Réviser</Text>
            </Pressable>
          )}
          
          <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter</Text>
          </Pressable>
        </View>
      )}

      {/* Liste des cartes */}
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Aucune carte</Text>
          <Text style={styles.emptySubtext}>
            Commencez par ajouter votre première carte !
          </Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>

      {/* Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* Modal d'options */}
      <Modal
        visible={showOptionsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsMenu}>
            <Pressable 
              style={styles.optionItem}
              onPress={handleToggleEditMode}
            >
              <Ionicons 
                name={editMode ? "checkmark-outline" : "create-outline"} 
                size={20} 
                color="#007AFF" 
              />
              <Text style={styles.optionText}>
                {editMode ? 'Terminer l\'édition' : 'Modifier les cartes'}
              </Text>
            </Pressable>
            
            <View style={styles.optionSeparator} />
            
            <Pressable 
              style={styles.optionItem}
              onPress={handleDeleteDeck}
              disabled={deletingDeck}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.deleteOptionText}>
                Supprimer le deck
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de confirmation de suppression du deck */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Supprimer le deck"
        message={`Êtes-vous sûr de vouloir supprimer "${deck?.name}" ? Cette action supprimera également toutes les cartes du deck et ne peut pas être annulée.`}
        onConfirm={confirmDeleteDeck}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Supprimer"
        cancelText="Annuler"
        confirmColor="#FF3B30"
        isLoading={deletingDeck}
      />

      {/* Modal de confirmation de suppression de carte */}
      <ConfirmModal
        visible={showDeleteCardConfirm}
        title="Supprimer la carte"
        message={`Êtes-vous sûr de vouloir supprimer cette carte ? Cette action ne peut pas être annulée.`}
        onConfirm={handleDeleteCard}
        onCancel={() => {
          setShowDeleteCardConfirm(false);
          setSelectedCard(null);
        }}
        confirmText="Supprimer"
        cancelText="Annuler"
        confirmColor="#FF3B30"
        isLoading={deletingCard}
      />

      {/* Modal d'erreur */}
      <ConfirmModal
        visible={showErrorModal}
        title="Erreur"
        message={errorMessage}
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
        confirmText="OK"
        cancelText=""
        confirmColor="#007AFF"
      />

      {/* Modal d'ajout de carte */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal}>
              <Text style={styles.cancelButton}>Annuler</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Nouvelle carte</Text>
            <Pressable 
              onPress={handleAddCard}
              disabled={addingCard}
              style={[styles.saveButton, addingCard && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, addingCard && styles.saveButtonTextDisabled]}>
                {addingCard ? 'Ajout...' : 'Ajouter'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Question</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { outlineWidth: 0 }
                ]}
                value={front}
                onChangeText={setFront}
                placeholder="Tapez votre question..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor="#007AFF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Réponse</Text>
              <TextInput
                  style={[
                    styles.textInput,
                    { outlineWidth: 0 }
                  ]}
                value={back}
                onChangeText={setBack}
                placeholder="Tapez votre réponse..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                selectionColor="#007AFF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Catégories ({categories.length}/3) - max 12 caractères</Text>
              
              {/* Affichage des catégories existantes */}
              {categories.length > 0 && (
                <View style={styles.categoriesDisplay}>
                  {categories.map((category, index) => (
                    <View key={index} style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{category}</Text>
                      <Pressable onPress={() => removeCategory(category)}>
                        <Ionicons name="close" size={16} color="#666" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Input pour nouvelle catégorie (si moins de 3) */}
              {categories.length < 3 && (
                <View style={styles.categoryInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.categoryInput, { outlineWidth: 0 }]}
                    value={newCategory}
                    onChangeText={handleNewCategoryChange}
                    placeholder="Ajouter une catégorie..."
                    returnKeyType="done"
                    autoCapitalize="words"
                    onSubmitEditing={addCategory}
                    underlineColorAndroid="transparent"
                    selectionColor="#007AFF"
                  />
                  <Pressable 
                    style={styles.addCategoryButton}
                    onPress={addCategory}
                    disabled={!newCategory.trim()}
                  >
                    <Ionicons name="add" size={20} color="#007AFF" />
                  </Pressable>
                </View>
              )}
              
              {/* Indicateur de caractères restants */}
              {categories.length < 3 && newCategory.length > 0 && (
                <Text style={[styles.characterCount, newCategory.length > 10 && styles.characterCountWarning, newCategory.length === 12 && styles.characterCountError]}>
                  {newCategory.length}/12 caractères
                </Text>
              )}
            </View>

            {(front || back) && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Aperçu</Text>
                <View style={styles.previewCards}>
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Recto</Text>
                    <Text style={styles.previewText}>
                      {front || 'Votre question...'}
                    </Text>
                  </View>
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Verso</Text>
                    <Text style={styles.previewText}>
                      {back || 'Votre réponse...'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de modification de carte */}
      <Modal
        visible={showEditCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal}>
              <Text style={styles.cancelButton}>Annuler</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Modifier la carte</Text>
            <Pressable 
              onPress={handleEditCard}
              disabled={editingCard}
              style={[styles.saveButton, editingCard && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, editingCard && styles.saveButtonTextDisabled]}>
                {editingCard ? 'Modification...' : 'Modifier'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Question</Text>
              <TextInput
                  style={[
                    styles.textInput,
                    { outlineWidth: 0 }
                  ]}
                value={front}
                onChangeText={setFront}
                placeholder="Tapez votre question..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor="#007AFF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Réponse</Text>
              <TextInput
                  style={[
                    styles.textInput,
                    { outlineWidth: 0 }
                  ]}
                value={back}
                onChangeText={setBack}
                placeholder="Tapez votre réponse..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                selectionColor="#007AFF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Catégories ({categories.length}/3)</Text>
              
              {/* Affichage des catégories existantes */}
              {categories.length > 0 && (
                <View style={styles.categoriesDisplay}>
                  {categories.map((category, index) => (
                    <View key={index} style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{category}</Text>
                      <Pressable onPress={() => removeCategory(category)}>
                        <Ionicons name="close" size={16} color="#666" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Input pour nouvelle catégorie (si moins de 3) */}
              {categories.length < 3 && (
                <View style={styles.categoryInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.categoryInput, { outlineWidth: 0 }]}
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholder="Ajouter une catégorie..."
                    returnKeyType="done"
                    autoCapitalize="words"
                    onSubmitEditing={addCategory}
                    underlineColorAndroid="transparent"
                    selectionColor="#007AFF"
                  />
                  <Pressable 
                    style={styles.addCategoryButton}
                    onPress={addCategory}
                    disabled={!newCategory.trim()}
                  >
                    <Ionicons name="add" size={20} color="#007AFF" />
                  </Pressable>
                </View>
              )}
            </View>

            {(front || back) && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Aperçu</Text>
                <View style={styles.previewCards}>
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Recto</Text>
                    <Text style={styles.previewText}>
                      {front || 'Votre question...'}
                    </Text>
                  </View>
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Verso</Text>
                    <Text style={styles.previewText}>
                      {back || 'Votre réponse...'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Styles personnalisés pour les nouvelles fonctionnalités de catégories
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#666',
    marginTop: 50,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#FF3B30',
    marginTop: 50,
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#f5f5f5',
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
  optionsButton: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  editModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    gap: 8,
  },
  editModeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  editModeCancel: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  deckInfo: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deckDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  deckStats: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  cardItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
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
  cardContent: {
    flex: 1,
  },
  cardFront: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardBack: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardCategory: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteOptionText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  optionSeparator: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 20,
  },
  modalContainer: {
  flex: 1,
  backgroundColor: '#f5f5f5',
  justifyContent: 'center',
  alignItems: 'center',
},
  modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
  backgroundColor: '#fff',
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
  width: '100%',
  maxWidth: 500,
},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  modalContent: {
  flex: 1,
  padding: 20,
  width: '100%',
  maxWidth: 500,
},
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  // Nouveaux styles pour les catégories multiples
  categoriesDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryInput: {
    flex: 1,
    minHeight: 50,
  },
  addCategoryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  characterCountWarning: {
    color: '#FF9500',
  },
  characterCountError: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  previewSection: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  previewCards: {
    flexDirection: 'row',
    gap: 10,
  },
  previewCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 120,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Styles pour la modal de confirmation
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#f0f0f0',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  cancelConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  confirmButtonTextDisabled: {
    color: '#ccc',
  },
  // Styles pour le toast
  toast: {
    position: 'absolute',
    top: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    width: '90%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  toastSuccess: {
    backgroundColor: '#34C759',
  },
  toastError: {
    backgroundColor: '#FF3B30',
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  optionsButtonEditMode: {
    backgroundColor: '#007AFF',
  },
});