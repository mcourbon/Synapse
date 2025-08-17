// components/AddCardModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  deckId: string;
  onCardAdded: () => void;
}

export default function AddCardModal({ 
  visible, 
  onClose, 
  deckId, 
  onCardAdded 
}: AddCardModalProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategoryInput, setCurrentCategoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  // Charger les catégories existantes du deck
  useEffect(() => {
    if (visible && deckId) {
      fetchExistingCategories();
    }
  }, [visible, deckId]);

  // Filtrer les catégories selon la saisie
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

  const fetchExistingCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('categories')
        .eq('deck_id', deckId)
        .not('categories', 'is', null);

      if (error) throw error;

      // Extraire et aplatir toutes les catégories uniques
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

  const handleAddCard = async () => {
    if (!question.trim() || !answer.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir la question et la réponse');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('cards')
        .insert([
          {
            deck_id: deckId,
            front: question.trim(),
            back: answer.trim(),
            categories: categories.length > 0 ? categories : null,
          }
        ]);

      if (error) {
        throw error;
      }

      // Réinitialiser les champs
      setQuestion('');
      setAnswer('');
      setCategories([]);
      setCurrentCategoryInput('');
      setShowCategorySuggestions(false);
      
      Alert.alert('Succès', 'Carte ajoutée avec succès !');
      onCardAdded();
      onClose();
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la carte');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuestion('');
    setAnswer('');
    setCategories([]);
    setCurrentCategoryInput('');
    setShowCategorySuggestions(false);
    onClose();
  };

  const addCategory = (newCategory: string) => {
  if (newCategory.trim() && 
      newCategory.length <= 12 && 
      categories.length < 3 && 
      !categories.includes(newCategory.trim())) {
    setCategories([...categories, newCategory.trim()]);
    setCurrentCategoryInput('');
    setShowCategorySuggestions(false);
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

  const selectCategory = (selectedCategory: string) => {
    addCategory(selectedCategory);
  };

  const renderCategorySuggestion = ({ item }: { item: string }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => selectCategory(item)}
    >
      <Ionicons name="pricetag-outline" size={16} color="#666" />
      <Text style={styles.suggestionText}>{item}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose}>
            <Text style={styles.cancelButton}>Annuler</Text>
          </Pressable>
          <Text style={styles.title}>Nouvelle carte</Text>
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

        {/* Form */}
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          {/* Question */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Question (Recto)</Text>
            <TextInput
              style={styles.textInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Tapez votre question..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Réponse */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Réponse (Verso)</Text>
            <TextInput
              style={styles.textInput}
              value={answer}
              onChangeText={setAnswer}
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
            
            {/* Tags des catégories sélectionnées */}
            {categories.length > 0 && (
              <View style={styles.selectedCategories}>
                {categories.map((cat, index) => (
                  <View key={index} style={styles.selectedCategoryTag}>
                    <Text style={styles.selectedCategoryText}>{cat}</Text>
                    <Pressable onPress={() => removeCategory(cat)}>
                      <Ionicons name="close-circle" size={18} color="#FF5252" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Input pour ajouter une catégorie */}
            {categories.length < 3 && (
              <View style={styles.categoryContainer}>
                <TextInput
                  style={[styles.textInput, styles.categoryInput]}
                  value={currentCategoryInput}
                  onChangeText={setCurrentCategoryInput}
                  placeholder="Ajouter une catégorie..."
                  maxLength={20}
                  returnKeyType="done"
                  autoCapitalize="words"
                  onSubmitEditing={handleCategoryInputSubmit}
                  onFocus={() => {
                    if (existingCategories.length > 0) {
                      setShowCategorySuggestions(true);
                    }
                  }}
                />
                
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
              </View>
            )}
            
            <Text style={styles.helperText}>
              Appuyez sur Entrée pour ajouter une catégorie
            </Text>
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Aperçu</Text>
            <View style={styles.previewCards}>
              <View style={styles.previewCard}>
                <View style={styles.previewCardHeader}>
                  <Text style={styles.previewLabel}>Recto</Text>
                  {categories.length > 0 && (
                    <View style={styles.previewCategories}>
                      {categories.map((cat, index) => (
                        <View key={index} style={styles.previewCategoryTag}>
                          <Text style={styles.previewCategoryTagText}>{cat}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.previewText}>
                  {question || 'Votre question apparaîtra ici...'}
                </Text>
              </View>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Verso</Text>
                <Text style={styles.previewText}>
                  {answer || 'Votre réponse apparaîtra ici...'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
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
  form: {
    flex: 1,
    padding: 20,
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  categoryInput: {
    minHeight: 50,
    paddingVertical: 12,
  },
  categoryContainer: {
    position: 'relative',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
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
    color: '#666',
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
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  popularCategories: {
    marginTop: 10,
  },
  popularTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryTags: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  categoryTagText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  previewSection: {
    marginTop: 20,
    marginBottom: 40,
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
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'normal',
  },
  previewCategoryTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  previewCategoryTagText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectedCategories: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 10,
  },
  selectedCategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  selectedCategoryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  previewCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
});