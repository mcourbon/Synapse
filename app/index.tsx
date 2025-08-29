import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Card, Deck } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import AddDeckModal from '../components/AddDeckModal';
import { useTheme } from '../contexts/ThemeContext';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showAddDeckModal, setShowAddDeckModal] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategoryInput, setCurrentCategoryInput] = useState('');
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const { theme, isDark } = useTheme();

  // Dans le composant, après const { theme } = useTheme();
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
  topBar: {
    position: 'absolute',
    top: 0,
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${theme.surface}dd`,
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
  tinycardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tinycard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 320,
    maxWidth: '90%',
    aspectRatio: 5/3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 28,
    overflow: 'hidden',
    zIndex: 2,
    position: 'relative',
    borderBottomWidth: 12,
    borderBottomColor: theme.primary,
  },
  
  tinycardText: {
    color: theme.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 32,
    zIndex: 2,
    paddingHorizontal: 32,
  },
  welcomeOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  welcomeText: {
     fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    backgroundColor: `${theme.surface}f2`,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 20,
    overflow: 'hidden',
    },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMainContent: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  saveButtonDisabled: {
    backgroundColor: isDark ? '#404040' : theme.textSecondary,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: isDark ? '#888888' : theme.background,
  },
  modalContent: {
    flex: 1,
    padding: 20,
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
  },
  textArea: {
    minHeight: 100,
  },
  noDeckContainer: {
    backgroundColor: theme.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  noDeckText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  createDeckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createDeckButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deckSelector: {
    marginBottom: 10,
  },
  deckOption: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  deckOptionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  deckOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  deckOptionTextSelected: {
    color: '#fff',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 5,
  },
  switchButtonText: {
    fontSize: 14,
    color: theme.primary,
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
  categoryContainer: {
    position: 'relative',
  },
  suggestionsContainer: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 150,
    marginTop: -12,
    zIndex: 1000,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 5,
    textTransform: 'uppercase',
  },
  suggestionsList: {
    maxHeight: 120,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  suggestionText: {
    fontSize: 16,
    color: theme.text,
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
  backgroundColor: `${theme.primary}20`,  // Changé de theme.primary à ${theme.primary}20
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  gap: 6,
},
categoryChipText: {
  fontSize: 14,
  color: theme.primary,  // Changé de '#fff' à theme.primary
  fontWeight: '500',
},
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryInput: {
    flex: 1,
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
});

  useEffect(() => {
    if (user) {
      fetchRandomCard();
    }
  }, [user]);

  useEffect(() => {
    if (showQuickAddModal && user) {
      fetchDecks();
    }
  }, [showQuickAddModal, user]);

  useEffect(() => {
  if (currentCategoryInput.trim() === '') {
    setFilteredCategories(existingCategories.filter(cat => !categories.includes(cat)));
    setShowCategorySuggestions(existingCategories.length > 0);
  } else {
    const filtered = existingCategories.filter(cat => 
      cat.toLowerCase().includes(currentCategoryInput.toLowerCase()) && 
      !categories.includes(cat)
    );
    setFilteredCategories(filtered);
    setShowCategorySuggestions(filtered.length > 0);
  }
}, [currentCategoryInput, existingCategories, categories]);

  useEffect(() => {
    if (selectedDeckId && showQuickAddModal) {
      fetchExistingCategories();
    }
  }, [selectedDeckId, showQuickAddModal]);

  async function fetchRandomCard() {
    if (!user) return;

    try {
      const { data: userCards, error } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id)
        `)
        .eq('decks.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Erreur lors de la récupération des cartes:', error);
        return;
      }

      if (userCards && userCards.length > 0) {
        const randomIndex = Math.floor(Math.random() * userCards.length);
        setCard(userCards[randomIndex]);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  }

  async function fetchDecks() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur:', error);
      } else {
        setDecks(data || []);
        if (data && data.length > 0) {
          setSelectedDeckId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  }

  const handleDeckCreated = async () => {
    console.log('Deck créé, rafraîchissement...');
    await fetchDecks();
  };

  const handleAddCard = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le recto et le verso');
      return;
    }

    if (!selectedDeckId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un deck');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour ajouter une carte');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('cards')
        .insert([
          {
            deck_id: selectedDeckId,
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
      setCurrentCategoryInput('');
      
      Alert.alert('Succès', 'Carte ajoutée avec succès !');
      closeModal();
      
      fetchRandomCard();
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la carte');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowQuickAddModal(false);
    setFront('');
    setBack('');
    setCategories([]);
    setCurrentCategoryInput('');
    setSelectedDeckId('');
    setShowCategorySuggestions(false);
    setExistingCategories([]);
  };

  const openQuickAdd = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour ajouter des cartes');
      return;
    }
    setShowQuickAddModal(true);
  };

  const addCategory = () => {
  if (!currentCategoryInput.trim()) return;
  
  const trimmedCategory = currentCategoryInput.trim();
  
  // Vérifier la longueur (12 caractères max)
  if (trimmedCategory.length > 12) {
    Alert.alert('Erreur', 'Les catégories sont limitées à 12 caractères');
    return;
  }
  
  // Vérifier si la catégorie n'existe pas déjà et qu'on ne dépasse pas 3 catégories
  if (!categories.includes(trimmedCategory) && categories.length < 3) {
    setCategories([...categories, trimmedCategory]);
    setCurrentCategoryInput('');
    setShowCategorySuggestions(false);
  } else if (categories.includes(trimmedCategory)) {
    Alert.alert('Erreur', 'Cette catégorie existe déjà');
  }
};

const handleCategoryInputChange = (text: string) => {
  if (text.length <= 12) {
    setCurrentCategoryInput(text);
  }
};

const removeCategory = (categoryToRemove: string) => {
  setCategories(categories.filter(cat => cat !== categoryToRemove));
};

const handleCategoryInputSubmit = () => {
  if (currentCategoryInput.trim()) {
    addCategory(currentCategoryInput);
  }
};

  const motivationalMessages = [
    "Prêt à apprendre quelque chose de nouveau ?",
    "Chaque carte révisée vous rapproche de vos objectifs !",
    "L'apprentissage est un voyage, pas une destination",
    "Votre cerveau est votre meilleur allié",
    "Aujourd'hui est le jour parfait pour réviser !",
    "La connaissance est le pouvoir le plus précieux",
    "Transformez vos minutes en moments d'apprentissage",
    "Chaque révision compte, continuez comme ça !",
    "Votre future version vous remerciera",
    "L'excellence est une habitude, pas un accident",
    "Apprenez aujourd'hui, brillez demain !",
    "Votre potentiel est illimité",
    "La répétition est la mère de l'apprentissage",
    "Investissez en vous, c'est le meilleur placement !",
    "Petit à petit, l'oiseau fait son nid",
    "Votre détermination vous mènera loin",
    "Chaque expert était autrefois un débutant",
    "L'apprentissage n'a pas d'âge limite",
    "Transformez votre curiosité en connaissance",
    "Vous êtes capable de plus que vous ne le pensez !"
  ];

  const getWelcomeMessage = () => {
    if (!user) return 'Bienvenue sur votre app de révision !';
    
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const hourBlock = Math.floor(now.getHours() / 4);
    const index = (dayOfYear + hourBlock) % motivationalMessages.length;
    
    return motivationalMessages[index];
  };

  const fetchExistingCategories = async () => {
  if (!selectedDeckId || !user) return;
  
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('categories')
      .eq('deck_id', selectedDeckId)
      .not('category', 'is', null);

    if (error) throw error;

    const allCategories = data
      .filter(item => item.categories && Array.isArray(item.categories))
      .flatMap(item => item.categories)
      .filter(Boolean);
    
    const uniqueCategories = [...new Set(allCategories)];
    setExistingCategories(uniqueCategories);
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error);
  }
  };

  const selectCategory = (selectedCategory: string) => {
  addCategory(selectedCategory);
};

const renderCategorySuggestion = ({ item }: { item: string }) => (
  <Pressable
    style={styles.suggestionItem}
    onPress={() => selectCategory(item)}
  >
    <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} />
    <Text style={styles.suggestionText}>{item}</Text>
  </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Flashcard en fond façon Tinycards */}
        <View style={styles.tinycardWrapper}>
          <Pressable
            style={styles.tinycard}
            onPress={() => {}}
          >
            <Text style={styles.tinycardText}>
              {card?.front || 'Commencez par créer votre premier deck !'}
            </Text>
          </Pressable>
        </View>

        {/* Message de bienvenue */}
        <View style={styles.welcomeOverlay}>
          <Text style={styles.welcomeText}>{getWelcomeMessage()}</Text>
        </View>

        {/* Bar en haut */}
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/decks')}>
            <Ionicons name="albums" size={28} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/profile')}>
            <Ionicons name="person" size={28} color={theme.primary} />
          </Pressable>
        </View>

        {/* Bouton flottant d'ajout rapide */}
        <Pressable style={styles.fab} onPress={openQuickAdd}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Modal d'ajout rapide */}
      <Modal
        visible={showQuickAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalMainContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={closeModal}>
                <Text style={styles.cancelButton}>Annuler</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Ajout rapide</Text>
              <Pressable 
                onPress={handleAddCard}
                disabled={loading}
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              >
                <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
                  {loading ? 'Ajout...' : 'Ajouter'}
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Sélection de deck */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Deck de destination</Text>
                
                {decks.length === 0 ? (
                  <View style={styles.noDeckContainer}>
                    <Text style={styles.noDeckText}>
                      Vous n'avez pas encore de collection. Créez-en une pour commencer !
                    </Text>
                    <Pressable 
                      style={styles.createDeckButton}
                      onPress={() => setShowAddDeckModal(true)}
                    >
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={styles.createDeckButtonText}>Créer ma première collection</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deckSelector}>
                      {decks.map((deck) => (
                        <Pressable
                          key={deck.id}
                          style={[
                            styles.deckOption,
                            selectedDeckId === deck.id && styles.deckOptionSelected
                          ]}
                          onPress={() => setSelectedDeckId(deck.id)}
                        >
                          <Text style={[
                            styles.deckOptionText,
                            selectedDeckId === deck.id && styles.deckOptionTextSelected
                          ]}>
                            {deck.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable 
                      style={styles.switchButton}
                      onPress={() => setShowAddDeckModal(true)}
                    >
                      <Ionicons name="add" size={16} color={theme.primary} />
                      <Text style={styles.switchButtonText}>Créer une nouvelle collection</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Formulaire de carte (seulement si un deck est sélectionné) */}
              {selectedDeckId && (
                <>
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
                    />
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
            style={[styles.textInput, styles.categoryInput, { outlineWidth: 0 }]}
            value={currentCategoryInput}
            onChangeText={handleCategoryInputChange}  // Utiliser la nouvelle fonction
            placeholder="Ajouter une catégorie..."
            returnKeyType="done"
            autoCapitalize="words"
            onSubmitEditing={handleCategoryInputSubmit}
            onFocus={() => {
              if (existingCategories.length > 0) {
                setShowCategorySuggestions(true);
              }
            }}
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
      
      {/* Suggestions */}
      {showCategorySuggestions && filteredCategories.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Catégories disponibles :</Text>
          <FlatList
            data={filteredCategories}
            renderItem={renderCategorySuggestion}
            keyExtractor={(item) => item}
            style={styles.suggestionsList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          />
        </View>
      )}
      
      {/* Catégories populaires */}
      {existingCategories.length > 0 && currentCategoryInput === '' && categories.length < 3 && (
        <View style={styles.popularCategories}>
          <Text style={styles.popularTitle}>Catégories récentes :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryTags}>
              {existingCategories.slice(0, 5).map((cat) => (
                <Pressable
                  key={cat}
                  style={styles.categoryTag}
                  onPress={() => selectCategory(cat)}
                >
                  <Text style={styles.categoryTagText}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
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
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal AddDeck pour créer un nouveau deck */}
      <AddDeckModal
        visible={showAddDeckModal}
        onClose={() => setShowAddDeckModal(false)}
        onDeckAdded={handleDeckCreated}
      />
    </SafeAreaView>
  );
}