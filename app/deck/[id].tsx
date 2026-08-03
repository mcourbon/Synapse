import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card, Deck } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import AddCardModal from '../../components/AddCardModal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import CardStatsModal from '../../components/CardStatsModal';
import { getCardMastery } from '../../utils/fsrs';
import { MASTERY_COLORS, MASTERY_LABELS, formatNextReview } from '../../utils/cardMastery';

// Couleurs de statut — module level (iOS safe, jamais dans StyleSheet inside component)
const staticStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabledLight: { backgroundColor: '#666666' },
  saveButtonDisabledDark: { backgroundColor: '#404040' },
  saveButtonTextDisabledLight: { color: '#f5f5f5' },
  saveButtonTextDisabledDark: { color: '#888888' },
});

export default function DeckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteCardConfirm, setShowDeleteCardConfirm] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategoryInput, setCurrentCategoryInput] = useState(''); // Remplace newCategory
  const [editingCard, setEditingCard] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [showCardStatsModal, setShowCardStatsModal] = useState(false);
  const [selectedCardForStats, setSelectedCardForStats] = useState<Card | null>(null);

  // Nouveaux états pour le système de tags avancé
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  
  const router = useRouter();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

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
  loadingText: {
    textAlign: 'center',
    fontSize: 18,
    color: theme.textSecondary,
    marginTop: 50,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 18,
    color: theme.error,
    marginTop: 50,
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
  optionsButton: {
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
  deckInfo: {
    paddingHorizontal: 20,
    paddingVertical: 0,
  },
  deckDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  deckStats: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.success,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  listContainer: {
    padding: 20,
  },
  cardItem: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  cardContent: {
    flex: 1,
  },
  cardFront: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  cardBack: {
    fontSize: 14,
    color: theme.textSecondary,
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
    color: theme.primary,
    backgroundColor: `${theme.primary}20`,
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
    backgroundColor: `${theme.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.error}20`,
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
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    width: '100%',
    maxWidth: 500,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
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
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: theme.text,
    minHeight: 100,
  },
  categoriesDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.primary}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryInput: {
    flex: 1,
    minHeight: 50,
    marginBottom: 0,
  },
  addCategoryButton: {
  width: 50,
  height: 50,
  borderRadius: 25,
  justifyContent: 'center',
  alignItems: 'center',
},
addCategoryButtonActive: {
  backgroundColor: theme.primary,
},
addCategoryButtonInactive: {
  backgroundColor: `${theme.primary}20`,
},
  characterCount: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  characterCountWarning: {
    color: theme.warning,
  },
  characterCountError: {
    color: theme.error,
    fontWeight: '600',
  },
  // Nouveaux styles pour les catégories populaires
  popularCategories: {
    marginTop: 15,
  },
  popularTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  categoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 2,
  },
  categoryTag: {
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryTagText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  previewSection: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  previewCards: {
    flexDirection: 'row',
    gap: 10,
  },
  previewCard: {
    flex: 1,
    backgroundColor: theme.surface,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 120,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
  optionsButtonEditMode: {
    backgroundColor: theme.primary,
  },
  // Badges sur les cartes
  cardBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap' as const,
  },
  reviewDateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  reviewDateText: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: theme.textSecondary,
  },
});

  // Charger les catégories existantes quand on ouvre le modal d'édition
  useEffect(() => {
    if (showEditCardModal && id) {
      fetchExistingCategories(id);
    }
  }, [showEditCardModal, id]);

  // Filtrer les catégories selon la saisie
  useEffect(() => {
    if (currentCategoryInput.trim() === '') {
      // Si pas de saisie, afficher les catégories récentes (exclure celles déjà sélectionnées)
      setFilteredCategories(existingCategories.filter(cat => !categories.includes(cat)));
    } else {
      // Si saisie, filtrer selon le texte
      const filtered = existingCategories.filter(cat => 
        cat.toLowerCase().includes(currentCategoryInput.toLowerCase()) && 
        !categories.includes(cat)
      );
      setFilteredCategories(filtered);
    }
  }, [currentCategoryInput, existingCategories, categories]);

  const fetchExistingCategories = async (deckId: string) => {
    if (!deckId || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('categories')
        .eq('deck_id', deckId)
        .not('categories', 'is', null);

      if (error) throw error;

      const allCategories = data
        .filter(item => item.categories && Array.isArray(item.categories))
        .flatMap(item => item.categories)
        .filter(Boolean);
      
      // Compter les occurrences et trier par fréquence puis par ordre alphabétique
      const categoryCount = allCategories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const uniqueCategories = Object.keys(categoryCount).sort((a, b) => {
        // Tri par fréquence décroissante, puis par ordre alphabétique
        const countDiff = categoryCount[b] - categoryCount[a];
        return countDiff !== 0 ? countDiff : a.localeCompare(b);
      });
      
      setExistingCategories(uniqueCategories);
    } catch (error) {
    }
  };

  // Fonction pour afficher un toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Fonction pour afficher une erreur
  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Fonction pour ajouter une catégorie (mise à jour)
  const addCategory = () => {
    if (!currentCategoryInput.trim()) return;
    
    const trimmedCategory = currentCategoryInput.trim();
    
    // Vérifier la longueur (12 caractères max)
    if (trimmedCategory.length > 12) {
      showError('Les catégories sont limitées à 12 caractères');
      return;
    }
    
    // Vérifier si la catégorie n'existe pas déjà et qu'on ne dépasse pas 3 catégories
    if (!categories.includes(trimmedCategory) && categories.length < 3) {
      setCategories([...categories, trimmedCategory]);
      setCurrentCategoryInput('');
    } else if (categories.includes(trimmedCategory)) {
      showError('Cette catégorie existe déjà');
    }
  };

  // Fonction pour gérer la saisie de nouvelle catégorie avec limitation
  const handleCategoryInputChange = (text: string) => {
    if (text.length <= 12) {
      setCurrentCategoryInput(text);
    }
  };

  // Fonction pour supprimer une catégorie
  const removeCategory = (categoryToRemove: string) => {
    setCategories(categories.filter(cat => cat !== categoryToRemove));
  };

  // Fonction pour gérer la soumission de l'input catégorie
  const handleCategoryInputSubmit = () => {
    if (currentCategoryInput.trim()) {
      addCategory();
    }
  };

  // Fonction pour sélectionner une catégorie depuis les suggestions
  const selectCategory = (selectedCategory: string) => {
    if (!categories.includes(selectedCategory) && categories.length < 3) {
      setCategories([...categories, selectedCategory]);
      setCurrentCategoryInput('');
    }
  };

  // Fonction pour obtenir le titre des catégories
  const getCategoryTitle = () => {
    if (currentCategoryInput.trim() !== '') {
      return filteredCategories.length > 0 ? 'Correspondances :' : 'Aucune correspondance';
    }
    return 'Catégories récentes :';
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
        showError('Impossible de charger les cartes');
      } else {
        setCards(cardsData || []);
      }

      setDeck(deckData);
    } catch (err) {
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
      setCurrentCategoryInput('');
      setSelectedCard(null);
      setShowEditCardModal(false);
      
      showToast('Carte modifiée avec succès !', 'success');
      fetchDeckAndCards();
    } catch (error: any) {
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
      showError(error.message || 'Impossible de supprimer la carte');
    } finally {
      setDeletingCard(false);
    }
  };


  const openEditCardModal = (card: Card) => {
    setSelectedCard(card);
    setFront(card.front);
    setBack(card.back);
    setCategories(card.categories || []);
    setCurrentCategoryInput('');
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
    setCurrentCategoryInput('');
    setSelectedCard(null);
    setExistingCategories([]);
    setFilteredCategories([]);
  };

  const renderCard = ({ item }: { item: Card }) => {
    const mastery = getCardMastery(
      item.stability,
      item.difficulty,
      item.lapses || 0
    );
    const masteryColor = MASTERY_COLORS[mastery] ?? '#8E8E93';
    const nextReviewLabel = formatNextReview(item.next_review);

    return (
      <Pressable
        style={styles.cardItem}
        onPress={() => {
          if (editMode) return;
          setSelectedCardForStats(item);
          setShowCardStatsModal(true);
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
          {/* Badges statut + prochaine révision */}
          <View style={styles.cardBadgeRow}>
            <View style={[staticStyles.badge, { backgroundColor: masteryColor }]}>
              <Text style={staticStyles.badgeText}>{MASTERY_LABELS[mastery] ?? mastery}</Text>
            </View>
            <View style={styles.reviewDateBadge}>
              <Text style={styles.reviewDateText}>{nextReviewLabel}</Text>
            </View>
          </View>
        </View>

        {editMode && (
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
        )}
      </Pressable>
    );
  };

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
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </Pressable>
            <View style={styles.titleContainer}>
              <Text style={styles.mainTitle}>{deck.name}</Text>
              <View style={styles.titleUnderline} />
            </View>
            <Pressable
              style={[styles.optionsButton, editMode && styles.optionsButtonEditMode]}
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
      <View style={styles.actionButtons}>
        {cards.length > 0 && (
          <Pressable style={styles.reviewButton} onPress={() => { setEditMode(false); handleStartReview(); }}>
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={staticStyles.reviewButtonText}>S'entraîner</Text>
          </Pressable>
        )}
        <Pressable style={styles.addButton} onPress={() => { setEditMode(false); setShowAddModal(true); }}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={staticStyles.addButtonText}>Ajouter</Text>
        </Pressable>
      </View>

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

      {/* Modal stats d'une carte */}
      <CardStatsModal
        visible={showCardStatsModal}
        card={selectedCardForStats}
        onClose={() => setShowCardStatsModal(false)}
      />

      {/* Modal d'ajout de carte */}
      <AddCardModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCardAdded={() => {
          fetchDeckAndCards();
          setShowAddModal(false);
        }}
        deckId={id} // Deck spécifique = pas de sélection
      />

      {/* Modal de modification de carte avec système de tags avancé */}
<Modal
  visible={showEditCardModal}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={closeModal}
>
  <SafeAreaView style={styles.modalContainer}>
    <View style={styles.mainContent}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <Pressable onPress={closeModal}>
          <Text style={styles.cancelButton}>Annuler</Text>
        </Pressable>
        <Text style={styles.modalTitle}>Modifier la carte</Text>
        <Pressable
          onPress={() => {
            if (editingCard || !front.trim() || !back.trim()) return;
            handleEditCard();
          }}
          style={[styles.saveButton, (editingCard || !front.trim() || !back.trim()) && (isDark ? staticStyles.saveButtonDisabledDark : staticStyles.saveButtonDisabledLight)]}
        >
          <Text style={[staticStyles.saveButtonText, (editingCard || !front.trim() || !back.trim()) && (isDark ? staticStyles.saveButtonTextDisabledDark : staticStyles.saveButtonTextDisabledLight)]}>
            {editingCard ? 'Modification...' : 'Modifier'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.modalContent}>
        {/* Formulaire */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Question</Text>
          <TextInput
            style={[styles.textInput, { outlineWidth: 0, borderColor: theme.primary }]}
            value={front}
            onChangeText={setFront}
            placeholder="Tapez votre question..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={{ fontSize: 12, color: front.length >= 300 ? '#EF4444' : front.length > 270 ? '#F59E0B' : theme.textSecondary, textAlign: 'right', marginTop: 4 }}>
            {front.length}/300
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Réponse</Text>
          <TextInput
            style={[styles.textInput, { outlineWidth: 0, borderColor: theme.primary }]}
            value={back}
            onChangeText={setBack}
            placeholder="Tapez votre réponse..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={{ fontSize: 12, color: back.length >= 300 ? '#EF4444' : back.length > 270 ? '#F59E0B' : theme.textSecondary, textAlign: 'right', marginTop: 4 }}>
            {back.length}/300
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Catégories ({categories.length}/3) - max 12 caractères
          </Text>
          
          {/* Affichage des catégories sélectionnées */}
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
                style={[styles.textInput, styles.categoryInput, { outlineWidth: 0, borderColor: theme.primary }]}
                value={currentCategoryInput}
                onChangeText={handleCategoryInputChange}
                placeholder="Ajouter une catégorie..."
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                autoCapitalize="words"
                onSubmitEditing={handleCategoryInputSubmit}
                underlineColorAndroid="transparent"
                selectionColor="#007AFF"
              />
              <Pressable 
                style={[
                  styles.addCategoryButton,
                  currentCategoryInput.trim() ? styles.addCategoryButtonActive : styles.addCategoryButtonInactive
                ]}
                onPress={handleCategoryInputSubmit}
                disabled={!currentCategoryInput.trim()}
              >
                <Ionicons 
                  name="add" 
                  size={20} 
                  color={currentCategoryInput.trim() ? "#fff" : theme.primary} 
                />
              </Pressable>
            </View>
          )}

          {/* Indicateur de caractères restants */}
          {categories.length < 3 && currentCategoryInput.length > 0 && (
            <Text style={[
              styles.characterCount, 
              currentCategoryInput.length > 10 && styles.characterCountWarning, 
              currentCategoryInput.length === 12 && styles.characterCountError
            ]}>
              {currentCategoryInput.length}/12 caractères
            </Text>
          )}
          
          {/* Catégories avec suggestions fusionnées */}
          {existingCategories.length > 0 && categories.length < 3 && filteredCategories.length > 0 && (
            <View style={styles.popularCategories}>
              <Text style={styles.popularTitle}>{getCategoryTitle()}</Text>
              <View style={styles.categoryTags}>
                {filteredCategories.slice(0, 8).map((cat) => (
                  <Pressable
                    key={cat}
                    style={styles.categoryTag}
                    onPress={() => selectCategory(cat)}
                  >
                    <Text style={styles.categoryTagText}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Aperçu */}
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
    </View>
  </SafeAreaView>
</Modal>
    </SafeAreaView>
  );
}