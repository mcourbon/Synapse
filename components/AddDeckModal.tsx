// components/AddDeckModal.tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AddDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onDeckAdded: () => void;
}

const DECK_COLORS = [
  { name: 'Bleu', value: '#007AFF' },
  { name: 'Vert', value: '#34C759' },
  { name: 'Orange', value: '#FF9500' },
  { name: 'Rouge', value: '#FF3B30' },
  { name: 'Violet', value: '#AF52DE' },
  { name: 'Rose', value: '#FF2D92' },
  { name: 'Indigo', value: '#5856D6' },
  { name: 'Teal', value: '#5AC8FA' },
];

export default function AddDeckModal({ 
  visible, 
  onClose, 
  onDeckAdded 
}: AddDeckModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(DECK_COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAddDeck = async () => {
    console.log('=== DÉBUT handleAddDeck ===');
    
    // Validation et nettoyage des inputs
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    
    // Validation de longueur
    if (!cleanName) {
      Alert.alert('Erreur', 'Veuillez donner un nom à votre collection');
      return;
    }
    
    if (cleanName.length > 15) {
      Alert.alert('Erreur', 'Le nom ne peut pas dépasser 15 caractères');
      return;
    }
    
    if (cleanDescription.length > 500) {
      Alert.alert('Erreur', 'La description ne peut pas dépasser 500 caractères');
      return;
    }
    
    // Validation de la couleur (sécurité)
    const validColors = DECK_COLORS.map(c => c.value);
    if (!validColors.includes(selectedColor)) {
      Alert.alert('Erreur', 'Couleur non valide');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour créer une collection');
      return;
    }

    setLoading(true);
    console.log('Loading activé');

    try {
      console.log('Tentative d\'insertion dans Supabase...');
      
      const insertData = {
        name: cleanName,
        description: cleanDescription || null,
        color: selectedColor,
        user_id: user.id
      };
      
      console.log('Données à insérer:', insertData);
      
      const { data, error } = await supabase
        .from('decks')
        .insert([insertData])
        .select();

      console.log('Réponse Supabase - data:', data);
      console.log('Réponse Supabase - error:', error);

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('Aucune donnée retournée par Supabase');
        throw new Error('Aucune donnée retournée par la base de données');
      }

      console.log('Collection créé avec succès:', data[0]);

      // Réinitialiser les champs
      console.log('Réinitialisation des champs...');
      setName('');
      setDescription('');
      setSelectedColor(DECK_COLORS[0].value);
      console.log('Champs réinitialisés');
      
      console.log('=== AVANT CALLBACKS ===');
      console.log('Type de onDeckAdded:', typeof onDeckAdded);
      console.log('Type de onClose:', typeof onClose);
      
      console.log('Appel de onDeckAdded...');
      await onDeckAdded();
      console.log('onDeckAdded terminé');
      
      console.log('Appel de onClose...');
      onClose();
      console.log('onClose terminé');
      
      console.log('Affichage du message de succès...');
      Alert.alert('Succès', 'Collection créée avec succès !');
      console.log('Message de succès affiché');
      
    } catch (error: any) {
      console.error('=== ERREUR COMPLÈTE ===');
      console.error('Message:', error?.message);
      console.error('Code:', error?.code);
      console.error('Stack:', error?.stack);
      
      Alert.alert(
        'Erreur', 
        `Impossible de créer la collection.\n\nDétails: ${error?.message || 'Erreur inconnue'}`
      );
    } finally {
      console.log('Loading désactivé');
      setLoading(false);
      console.log('=== FIN handleAddDeck ===');
    }
  };

  const handleClose = () => {
    // Réinitialiser les champs lors de la fermeture
    setName('');
    setDescription('');
    setSelectedColor(DECK_COLORS[0].value);
    setLoading(false);
    onClose();
  };

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
          <Text style={styles.title}>Nouvelle collection</Text>
          <Pressable 
            onPress={handleAddDeck}
            disabled={loading || !name.trim()}
            style={[
              styles.saveButton, 
              (loading || !name.trim()) && styles.saveButtonDisabled
            ]}
          >
            <Text style={[
              styles.saveButtonText, 
              (loading || !name.trim()) && styles.saveButtonTextDisabled
            ]}>
              {loading ? 'Création...' : 'Créer'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Form */}
          <View style={styles.form}>
            {/* Nom de la collection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom de la collection *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Vocabulaire anglais, Histoire..."
                autoFocus
                editable={!loading}
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (optionnel)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez brièvement le contenu de cette collection..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
                maxLength={500}
              />
            </View>

            {/* Sélection de couleur */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Couleur du thème</Text>
              <View style={styles.colorGrid}>
                {DECK_COLORS.map((color) => (
                  <Pressable
                    key={color.value}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color.value },
                      selectedColor === color.value && styles.colorOptionSelected
                    ]}
                    onPress={() => setSelectedColor(color.value)}
                    disabled={loading}
                  >
                    {selectedColor === color.value && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
              <Text style={styles.colorName}>
                {DECK_COLORS.find(c => c.value === selectedColor)?.name}
              </Text>
            </View>

            {/* Preview */}
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Aperçu</Text>
              <View style={[styles.previewCard, { borderLeftColor: selectedColor }]}>
                <View style={styles.previewHeader}>
                  <Text style={[
                    styles.previewName,
                    { color: name ? '#333' : '#999', fontStyle: name ? 'normal' : 'italic' }
                  ]}>
                    {name || 'Nom de la collection'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
                {(description || !name) && (
                  <Text style={[
                    styles.previewDescription,
                    { color: description ? '#666' : '#999', fontStyle: description ? 'normal' : 'italic' }
                  ]}>
                    {description || 'Description de la collection (optionnel)'}
                  </Text>
                )}
              </View>
            </View>

            {/* Tips */}
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>💡 Conseils</Text>
              <Text style={styles.tipsText}>
                • Choisissez un nom descriptif{'\n'}
                • Sélectionnez une couleur pour organiser vos collections{'\n'}
                • Commencez avec 10-20 cartes maximum
              </Text>
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
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  colorOptionSelected: {
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  colorName: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  previewSection: {
    marginBottom: 25,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  previewCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  previewDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  previewDate: {
    fontSize: 12,
    color: '#999',
  },
  tipsSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tipsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});