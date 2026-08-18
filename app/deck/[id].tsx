import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, Animated, BackHandler, Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card, Deck } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import AddCardModal from '../../components/AddCardModal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import CardStatsModal from '../../components/CardStatsModal';
import { getCardMastery, difficultyToEasePercent } from '../../utils/fsrs';
import { MASTERY_COLORS, MASTERY_LABELS, formatNextReview } from '../../utils/cardMastery';
import ProfessionalProgressCircle from '../../components/ProfessionalProgressCircle';
import AnimatedSuccessIcon from '../../components/AnimatedSuccessIcon';
import StreakFlame from '../../components/StreakFlame';

// Couleurs hardcodées — module level (iOS safe, jamais dans StyleSheet inside component)
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
  endSessionOverlayLight: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  endSessionOverlayDark: { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  continueButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    textAlign: 'center',
  },
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

  // ---- Mode liste <-> entraînement ----
  // Anciennement une vraie navigation vers /card/[id] (push par défaut, jamais
  // presentation:'modal'). Même symptôme que review/global avant sa fusion dans
  // index.tsx : écran blanc/noir + freeze au tap sur "S'entraîner" sur Android,
  // la transition native de la route ne s'en sortant pas proprement une fois
  // l'edge-to-edge Android actif. Fix identique : plus de navigation, le mode
  // entraînement devient un second visuel de cet écran ('list' | 'training').
  // Reprend telle quelle la logique de l'ex app/card/[id].tsx : aucune écriture
  // FSRS/stats réelle (voir handleDifficultyResponse), bouclage complet du deck
  // possible ("Continuer" sur le modal de fin), flip/re-flip libre de la carte.
  const [mode, setMode] = useState<'list' | 'training'>('list');
  const [trainingCards, setTrainingCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const answeringRef = useRef(false);

  // Animations (mode entraînement)
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const borderColorAnimation = useRef(new Animated.Value(0)).current;
  const buttonScaleAnimations = {
    hard: useRef(new Animated.Value(1)).current,
    medium: useRef(new Animated.Value(1)).current,
    easy: useRef(new Animated.Value(1)).current,
  };
  const circleProgressAnimation = useRef(new Animated.Value(0)).current;
  const checkScaleAnimation = useRef(new Animated.Value(0)).current;
  const modalBackgroundAnimation = useRef(new Animated.Value(0)).current;
  const modalScaleAnimation = useRef(new Animated.Value(0.8)).current;

  const router = useRouter();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  // Calculé à la main plutôt que délégué à un marginTop fixe : ce header flottant
  // (mode entraînement) est sur un écran poussé dans la pile (pas l'écran racine
  // comme index.tsx), et dans ce contexte SafeAreaView ne rend pas le même inset
  // du haut sur Android edge-to-edge — d'où le décalage constaté par rapport au
  // header de l'écran de révision. insets.top donne la vraie valeur, fiable.
  const insets = useSafeAreaInsets();

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
    position: 'relative',
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

  // ---- Mode entraînement (ex app/card/[id].tsx) ----
  floatingHeader: {
    // top: insets.top plutôt qu'un marginTop fixe deviné — cet écran est poussé
    // dans la pile (pas l'écran racine), et SafeAreaView n'y rend pas le même
    // inset du haut sur Android edge-to-edge ; un chiffre en dur calé pour matcher
    // index.tsx ne matchait pas réellement. insets.top est la vraie valeur.
    position: 'absolute',
    top: insets.top,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 15,
    zIndex: 10,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  headerCenter: {
    // Pas de marginTop propre : floatingHeader porte maintenant le marginTop
    // global, sinon ce bloc se retrouvait décalé plus bas que le bouton retour.
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  deckName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    textAlign: 'center',
  },
  cardProgress: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 250,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // Largeur portée par ce wrapper plutôt que par `card` lui-même : `card` est le
  // nœud qui anime borderBottomColor (JS driver), `cardScaleWrapper` celui qui
  // anime le transform scale (native driver) — mélanger les deux animations sur
  // le même nœud plante Android/Hermes dès qu'on relance l'anim de couleur après
  // un scale natif ("Attempting to run JS driven animation on animated node that
  // has been moved to native"), cf. bug écran noir au clic sur Facile/Moyen.
  cardScaleWrapper: {
    width: '100%',
    maxWidth: 380,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    minHeight: 250,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderBottomWidth: 8,
    borderBottomColor: theme.primary,
  },
  trainingCardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  questionSection: {
    alignItems: 'center',
  },
  answerSection: {
    alignItems: 'center',
  },
  separator: {
    height: 2,
    backgroundColor: theme.border,
    marginVertical: 20,
    borderRadius: 1,
    alignSelf: 'stretch',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    textAlign: 'center',
    color: theme.text,
  },
  difficultyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignSelf: 'center',
    maxWidth: 500,
  },
  difficultyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
  difficultyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 80,
  },
  difficultyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  cardStatsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  cardStatsText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  endSessionOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  endSessionModal: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 8,
  },
  progressCircleContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  endSessionSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  endSessionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  endSessionMessage: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  endSessionButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 16,
  },
  endSessionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    minHeight: 100,
  },
  continueButton: {
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stopButton: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
  },
  buttonIconContainer: {
    marginBottom: 8,
    padding: 4,
  },
  stopButtonText: {
    color: theme.textSecondary,
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  stopButtonSubtext: {
    color: theme.textSecondary,
    fontSize: 13,
    textAlign: 'center',
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

  // Mélange Fisher-Yates, utilisé pour démarrer et pour "Continuer" (remélanger)
  // le mode entraînement.
  const shuffleCards = (list: Card[]) => {
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Carte actuellement affichée en mode entraînement — dérivée de trainingCards/
  // currentCardIndex plutôt que dupliquée dans son propre state (l'ex card/[id].tsx
  // gardait un `card` séparé, synchronisé à la main à chaque changement de carte).
  const trainingCard = trainingCards[currentCardIndex];

  const handleStartReview = () => {
    if (cards.length === 0) {
      showError('Ce deck ne contient aucune carte à réviser');
      return;
    }

    setTrainingCards(shuffleCards(cards));
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedDifficulty(null);
    setStreak(0);
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);
    scaleAnimation.setValue(1);
    setMode('training');
  };

  // Retour à la liste depuis le mode entraînement (bouton retour ou bouton
  // matériel Android) — plus de navigation, donc rien à dépiler.
  const exitTraining = () => {
    setMode('list');
  };

  // Bouton retour matériel Android : en entraînement, on revient à la liste du
  // deck plutôt que de quitter l'écran (pas de route empilée, tout se passe ici).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'training') {
        exitTraining();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Raccourcis clavier (web) en mode entraînement : espace pour retourner la
  // carte, 1/2/3 pour répondre une fois la réponse affichée.
  useFocusEffect(
    useCallback(() => {
      const handleKeyPress = (event: KeyboardEvent) => {
        if (mode !== 'training' || showEndSessionModal) return;

        switch (event.key) {
          case ' ':
            event.preventDefault();
            handleToggleAnswer();
            break;
          case '1':
            if (showAnswer) {
              event.preventDefault();
              animateButton('hard');
              handleDifficultyResponse('hard');
            }
            break;
          case '2':
            if (showAnswer) {
              event.preventDefault();
              animateButton('medium');
              handleDifficultyResponse('medium');
            }
            break;
          case '3':
            if (showAnswer) {
              event.preventDefault();
              animateButton('easy');
              handleDifficultyResponse('easy');
            }
            break;
        }
      };

      // `typeof window !== 'undefined'` n'est PAS un test fiable de "web
      // uniquement" ici : React Native définit global.window = global comme
      // polyfill, donc ce test passe aussi sur Android/iOS — mais
      // window.addEventListener n'y existe pas, ce qui plantait l'app
      // (TypeError: undefined is not a function) dès que ce hook se montait,
      // avant même d'atteindre le mode entraînement. Platform.OS est le seul
      // check fiable pour du code réellement web-only.
      if (Platform.OS === 'web') {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, showAnswer, showEndSessionModal])
  );

  const handleToggleAnswer = () => {
    if (!showAnswer) {
      setShowAnswer(true);
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setShowAnswer(false);
      fadeAnimation.setValue(0);
    }
  };

  // Fonction pour animer un bouton spécifique
  const animateButton = (buttonType: 'hard' | 'medium' | 'easy') => {
    Animated.sequence([
      Animated.timing(buttonScaleAnimations[buttonType], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnimations[buttonType], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fonction pour passer à la carte suivante
  const goToNextCard = () => {
    if (trainingCards.length <= 1) {
      // S'il n'y a qu'une seule carte, retourner à la liste du deck
      exitTraining();
      return;
    }

    const nextIndex = currentCardIndex + 1;

    // Vérifier si on arrive à la fin du deck
    if (nextIndex >= trainingCards.length) {
      // On a fini toutes les cartes - proposer les options avec animation professionnelle
      setShowEndSessionModal(true);

      // Animation d'entrée du modal
      Animated.parallel([
        Animated.timing(modalBackgroundAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalScaleAnimation, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Démarrer l'animation du cercle de progression après un délai
      setTimeout(() => {
        // Reset des animations
        circleProgressAnimation.setValue(0);
        checkScaleAnimation.setValue(0);

        // Animation du cercle de progression (2.5 secondes avec easing)
        Animated.timing(circleProgressAnimation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }).start();

        // Animation du check qui apparaît après 2 secondes
        setTimeout(() => {
          Animated.spring(checkScaleAnimation, {
            toValue: 1,
            tension: 150,
            friction: 6,
            useNativeDriver: true,
          }).start();
        }, 2000);
      }, 400);

      return;
    }

    // Sinon, continuer normalement
    setShowAnswer(false);
    setSelectedDifficulty(null);
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);
    setCurrentCardIndex(nextIndex);

    // Animation d'entrée pour la nouvelle carte
    scaleAnimation.setValue(0.8);
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleContinueReview = () => {
    // Remélanger les cartes
    const shuffled = shuffleCards(trainingCards);
    setTrainingCards(shuffled);

    // Repartir à la première carte
    setCurrentCardIndex(0);

    // Réinitialiser l'état
    setShowAnswer(false);
    setSelectedDifficulty(null);
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);

    // Reset des animations du modal
    circleProgressAnimation.setValue(0);
    checkScaleAnimation.setValue(0);
    modalBackgroundAnimation.setValue(0);
    modalScaleAnimation.setValue(0.8);

    // Fermer la modal avec animation
    Animated.parallel([
      Animated.timing(modalBackgroundAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnimation, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEndSessionModal(false);
    });

    // Animation d'entrée
    scaleAnimation.setValue(0.8);
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleEndReview = () => {
    // Animation de sortie du modal
    Animated.parallel([
      Animated.timing(modalBackgroundAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnimation, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset des animations du modal
      circleProgressAnimation.setValue(0);
      checkScaleAnimation.setValue(0);
      modalBackgroundAnimation.setValue(0);
      modalScaleAnimation.setValue(0.8);
      setShowEndSessionModal(false);
      exitTraining();
    });
  };

  const handleDifficultyResponse = async (difficulty: 'hard' | 'medium' | 'easy') => {
    if (answeringRef.current || !trainingCard) return;
    answeringRef.current = true;

    // Changer la couleur du texte immédiatement
    setSelectedDifficulty(difficulty);

    // Streak de réussites d'affilée : "Facile" l'incrémente, "Difficile" le remet à zéro
    if (difficulty === 'easy') {
      setStreak(prev => prev + 1);
    } else if (difficulty === 'hard') {
      setStreak(0);
    }

    // ANIMATION DE COULEUR POUR TOUS LES BOUTONS
    borderColorAnimation.setValue(1);

    // Animation de feedback rapide sur la carte pour "medium" et "easy" (pas pour "hard")
    if (difficulty !== 'hard') {
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 0.95,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // MODE ENTRAÎNEMENT - Pas de modification des stats réelles

    // Gestion différente selon la difficulté
    if (difficulty === 'hard') {
      // Pour "hard", on reste sur la même carte avec animation de reset
      setTimeout(() => {
        // Reset après 1 secondes
        setShowAnswer(false);
        setSelectedDifficulty(null);
        fadeAnimation.setValue(0);

        // Animation de disparition de la bordure rouge
        Animated.timing(borderColorAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
        answeringRef.current = false;
      }, 1000);
    } else {
      // Pour "medium" et "easy", passer à la carte suivante après un délai
      setTimeout(() => {
        // Animation de disparition de la bordure colorée
        Animated.timing(borderColorAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }).start();

        // Animation de sortie de la carte
        Animated.timing(scaleAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          goToNextCard();
          answeringRef.current = false;
        });
      }, 500);
    }
  };

  // Fonction pour obtenir la couleur du texte selon la difficulté sélectionnée
  const getTextColor = () => {
    if (selectedDifficulty === 'hard') return '#FF3B30';
    if (selectedDifficulty === 'medium') return '#FF9500';
    if (selectedDifficulty === 'easy') return '#34C759';
    return theme.text;
  };

  // Fonction pour obtenir la couleur de bordure selon la difficulté sélectionnée
  const getAnimatedBorderColor = () => {
    if (!selectedDifficulty || !borderColorAnimation) {
      // Pas de sélection = couleur primaire du thème
      return theme.primary;
    }

    // Animation de la couleur selon la difficulté
    let targetColor = theme.primary;
    if (selectedDifficulty === 'hard') targetColor = '#FF3B30';
    if (selectedDifficulty === 'medium') targetColor = '#FF9500';
    if (selectedDifficulty === 'easy') targetColor = '#34C759';

    return borderColorAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.primary, targetColor],
    });
  };

  const getButtonStyle = (buttonType: 'hard' | 'medium' | 'easy') => {
    // Styles par défaut adaptés au thème
    let defaultStyle = {};
    if (buttonType === 'hard') defaultStyle = {
      backgroundColor: isDark ? '#4A1A1A' : '#FFF5F5',
      borderColor: '#FF3B30'
    };
    if (buttonType === 'medium') defaultStyle = {
      backgroundColor: isDark ? '#4A2A0F' : '#FFFBF0',
      borderColor: '#FF9500'
    };
    if (buttonType === 'easy') defaultStyle = {
      backgroundColor: isDark ? '#1A3A1A' : '#F0FFF4',
      borderColor: '#34C759'
    };

    // Si ce bouton est sélectionné, utiliser la couleur pleine
    if (selectedDifficulty === buttonType) {
      if (buttonType === 'hard') return { backgroundColor: '#FF3B30', borderColor: '#FF3B30' };
      if (buttonType === 'medium') return { backgroundColor: '#FF9500', borderColor: '#FF9500' };
      if (buttonType === 'easy') return { backgroundColor: '#34C759', borderColor: '#34C759' };
    }

    return defaultStyle;
  };

  const getButtonTextColor = (buttonType: 'hard' | 'medium' | 'easy') => {
    // Si le bouton est sélectionné, texte blanc
    if (selectedDifficulty === buttonType) {
      return "#fff";
    }

    // Sinon, couleur adaptée au thème
    return isDark ? '#fff' : '#333';
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
      {mode === 'list' || !trainingCard ? (
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
      ) : (
      <>
        {/* Header flottant (mode entraînement) */}
        <View style={styles.floatingHeader}>
          <Pressable style={styles.backButton} onPress={exitTraining}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.deckName}>{deck.name}</Text>
            {trainingCards.length > 1 && (
              <Text style={styles.cardProgress}>
                {currentCardIndex + 1} / {trainingCards.length}
              </Text>
            )}
          </View>
          <StreakFlame streak={streak} />
        </View>

        {/* Container principal - Zone cliquable */}
        <Pressable
          style={styles.mainContent}
          onPress={handleToggleAnswer}
        >
          {/* Carte principale - toujours centrée.
              Transform (scale) et borderBottomColor animent chacun sur leur propre
              Animated.View — voir le commentaire sur cardScaleWrapper plus haut. */}
          <View style={styles.cardContainer}>
            <Animated.View style={[styles.cardScaleWrapper, { transform: [{ scale: scaleAnimation }] }]}>
            <Animated.View
              style={[
                styles.card,
                { borderBottomColor: getAnimatedBorderColor() }
              ]}
            >
              <View style={styles.trainingCardContent}>
                {/* Section Question - toujours visible */}
                <View style={styles.questionSection}>
                  <Text style={[styles.cardText, { color: getTextColor() }]}>
                    {trainingCard.front}
                  </Text>
                </View>

                {/* Séparateur quand la réponse est affichée */}
                {showAnswer && <View style={styles.separator} />}

                {/* Section Réponse - apparaît avec animation */}
                {showAnswer && (
                  <Animated.View
                    style={[
                      styles.answerSection,
                      { opacity: fadeAnimation }
                    ]}
                  >
                    <Text style={[styles.cardText, { color: getTextColor() }]}>
                      {trainingCard.back}
                    </Text>
                  </Animated.View>
                )}
              </View>
            </Animated.View>
            </Animated.View>
          </View>

          {/* Boutons de difficulté */}
          {showAnswer && (
            <Pressable
              style={styles.difficultyContainer}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.difficultyTitle}>Comment avez-vous trouvé cette carte ?</Text>

              <View style={styles.difficultyButtons}>
                <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.hard }] }]}>
                  <Pressable
                    style={[
                      styles.difficultyButton,
                      getButtonStyle('hard')
                    ]}
                    onPress={() => {
                      animateButton('hard');
                      handleDifficultyResponse('hard');
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={24}
                      color={selectedDifficulty === 'hard' ? "#fff" : "#FF3B30"}
                    />
                    <Text style={[
                      styles.difficultyButtonText,
                      { color: getButtonTextColor('hard') }
                    ]}>
                      Difficile
                    </Text>
                  </Pressable>
                </Animated.View>

                <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.medium }] }]}>
                  <Pressable
                    style={[
                      styles.difficultyButton,
                      getButtonStyle('medium')
                    ]}
                    onPress={() => {
                      animateButton('medium');
                      handleDifficultyResponse('medium');
                    }}
                  >
                    <Ionicons
                      name="help-circle"
                      size={24}
                      color={selectedDifficulty === 'medium' ? "#fff" : "#FF9500"}
                    />
                    <Text style={[
                      styles.difficultyButtonText,
                      { color: getButtonTextColor('medium') }
                    ]}>
                      Moyen
                    </Text>
                  </Pressable>
                </Animated.View>

                <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.easy }] }]}>
                  <Pressable
                    style={[
                      styles.difficultyButton,
                      getButtonStyle('easy')
                    ]}
                    onPress={() => {
                      animateButton('easy');
                      handleDifficultyResponse('easy');
                    }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={selectedDifficulty === 'easy' ? "#fff" : "#34C759"}
                    />
                    <Text style={[
                      styles.difficultyButtonText,
                      { color: getButtonTextColor('easy') }
                    ]}>
                      Facile
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>

              {/* Indicateur de progression */}
              <View style={styles.cardStatsContainer}>
                <Text style={styles.cardStatsText}>
                  Win Streak: {trainingCard.repetitions || 0} •
                  Facilité: {difficultyToEasePercent(trainingCard.difficulty) ?? '—'}% •
                  Statut: {getCardMastery(
                    trainingCard.stability,
                    trainingCard.difficulty,
                    trainingCard.lapses || 0
                  )}
                </Text>
              </View>
            </Pressable>
          )}
        </Pressable>
      </>
      )}

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
  statusBarTranslucent
  navigationBarTranslucent
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

      {/* Modal de fin de session (mode entraînement) */}
      <Modal
        visible={showEndSessionModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowEndSessionModal(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Animated.View
          style={[
            styles.endSessionOverlay,
            isDark ? staticStyles.endSessionOverlayDark : staticStyles.endSessionOverlayLight,
            {
              opacity: modalBackgroundAnimation,
            }
          ]}
        >
          <Animated.View
            style={[
              styles.endSessionModal,
              {
                transform: [{ scale: modalScaleAnimation }],
              }
            ]}
          >
            {/* Animation professionnelle avec cercle et icône */}
            <View style={styles.iconContainer}>
              <View style={styles.progressCircleContainer}>
                <ProfessionalProgressCircle
                  progress={circleProgressAnimation}
                  size={100}
                  isDark={isDark}
                />
                <AnimatedSuccessIcon scale={checkScaleAnimation} />
              </View>
            </View>

            <Text style={styles.endSessionTitle}>
              Bravo !
            </Text>

            <Text style={styles.endSessionSubtitle}>
              Vous avez terminé toutes les cartes
            </Text>

            <Text style={styles.endSessionMessage}>
              Continuez pour réviser à nouveau ou terminez votre session.
            </Text>

            <View style={styles.endSessionButtons}>
              {/* Bouton Terminer */}
              <Pressable
                style={[styles.endSessionButton, styles.stopButton]}
                onPress={handleEndReview}
              >
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="home-outline" size={22} color={theme.textSecondary} />
                </View>
                <Text style={styles.stopButtonText}>Terminer</Text>
                <Text style={styles.stopButtonSubtext}>Retour au deck</Text>
              </Pressable>

              {/* Bouton Continuer */}
              <Pressable
                style={[styles.endSessionButton, styles.continueButton]}
                onPress={handleContinueReview}
              >
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                </View>
                <Text style={staticStyles.continueButtonText}>Continuer</Text>
                <Text style={staticStyles.continueButtonSubtext}>Remélanger</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
