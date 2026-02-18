// components/AddCardModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Deck } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AddDeckModal from './AddDeckModal';

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onCardAdded: () => void;
  // Si deckId est fourni, on est dans le contexte d'un deck spécifique
  // Si null/undefined, on affiche la sélection de deck (contexte index)
  deckId?: string | null;
}

export default function AddCardModal({ 
  visible, 
  onClose, 
  onCardAdded,
  deckId = null
}: AddCardModalProps) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  
  // États pour le formulaire
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategoryInput, setCurrentCategoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // États pour la sélection de deck (si deckId n'est pas fourni)
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [showAddDeckModal, setShowAddDeckModal] = useState(false);
  
  // États pour les catégories
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  // Styles dynamiques
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
      minHeight: 50,
    },
    // Styles pour la sélection de deck
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
    // Styles pour les catégories
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
    // Preview
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
  });

  // Charger les decks si on est en mode sélection (pas de deckId fourni)
  useEffect(() => {
    if (visible && !deckId && user) {
      fetchDecks();
    }
  }, [visible, deckId, user]);

  // Charger les catégories existantes
  useEffect(() => {
    const targetDeckId = deckId || selectedDeckId;
    if (targetDeckId && visible) {
      fetchExistingCategories(targetDeckId);
    }
  }, [deckId, selectedDeckId, visible]);

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

  const fetchDecks = async () => {
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
  };

  const fetchExistingCategories = async (targetDeckId: string) => {
    if (!targetDeckId || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('categories')
        .eq('deck_id', targetDeckId)
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
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const handleDeckCreated = async () => {
    console.log('Deck créé, rafraîchissement...');
    await fetchDecks();
    setShowAddDeckModal(false);
  };

  const handleAddCard = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le recto et le verso');
      return;
    }

    const targetDeckId = deckId || selectedDeckId;
    if (!targetDeckId) {
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
            deck_id: targetDeckId,
            front: front.trim(),
            back: back.trim(),
            categories: categories.length > 0 ? categories : null,
          }
        ]);

      if (error) {
        throw error;
      }

      Alert.alert('Succès', 'Carte ajoutée avec succès !');
      closeModal();
      onCardAdded();
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la carte');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setFront('');
    setBack('');
    setCategories([]);
    setCurrentCategoryInput('');
    setSelectedDeckId('');
    setExistingCategories([]);
    onClose();
  };

  const addCategory = () => {
    if (!currentCategoryInput.trim()) return;
    
    const trimmedCategory = currentCategoryInput.trim();
    
    if (trimmedCategory.length > 12) {
      Alert.alert('Erreur', 'Les catégories sont limitées à 12 caractères');
      return;
    }
    
    if (!categories.includes(trimmedCategory) && categories.length < 3) {
      setCategories([...categories, trimmedCategory]);
      setCurrentCategoryInput('');
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
      addCategory();
    }
  };

  const selectCategory = (selectedCategory: string) => {
    if (!categories.includes(selectedCategory) && categories.length < 3) {
      setCategories([...categories, selectedCategory]);
      setCurrentCategoryInput('');
    }
  };

  const getCategoryTitle = () => {
    if (currentCategoryInput.trim() !== '') {
      return filteredCategories.length > 0 ? 'Correspondances :' : 'Aucune correspondance';
    }
    return 'Catégories récentes :';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeModal}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.mainContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal}>
              <Text style={styles.cancelButton}>Annuler</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {deckId ? 'Nouvelle carte' : 'Ajout rapide'}
            </Text>
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
            {/* Sélection de deck (seulement si deckId n'est pas fourni) */}
            {!deckId && (
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
            )}

            {/* Formulaire de carte (seulement si un deck est sélectionné ou fourni) */}
            {(deckId || selectedDeckId) && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Question</Text>
                  <TextInput
                    style={[styles.textInput, { outlineWidth: 0, borderColor: theme.primary }]}
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
                    style={[styles.textInput, { outlineWidth: 0, borderColor: theme.primary }]}
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
                        style={[styles.textInput, styles.categoryInput, { outlineWidth: 0, borderColor: theme.primary }]}
                        value={currentCategoryInput}
                        onChangeText={handleCategoryInputChange}
                        placeholder="Ajouter une catégorie..."
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
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Modal AddDeck pour créer un nouveau deck */}
      <AddDeckModal
        visible={showAddDeckModal}
        onClose={() => setShowAddDeckModal(false)}
        onDeckAdded={handleDeckCreated}
      />
    </Modal>
  );
}