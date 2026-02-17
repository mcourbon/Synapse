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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface AddDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onDeckAdded: () => void;
}

const DECK_COLORS = [
  { name: 'Bleu océan', value: '#007AFF' },
  { name: 'Vert forêt', value: '#38A169' },
  { name: 'Orange sunset', value: '#FF6B35' },
  { name: 'Rouge cardinal', value: '#E53E3E' },
  { name: 'Violet royal', value: '#805AD5' },
  { name: 'Rose flamant', value: '#ED64A6' },
  { name: 'Noir Charbon', value: '#1F2937' },
  { name: 'Jaune soleil', value: '#FFE600' },
  { name: 'Marron chocolat', value: '#8B4513' },
  { name: 'Turquoise', value: '#38B2AC' },
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
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
    color: theme.text,
    marginBottom: 12,
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadow,
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
    color: theme.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  previewSection: {
    marginBottom: 25,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  previewCard: {
    backgroundColor: theme.surface,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 8,
    shadowColor: theme.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
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
  tipsSection: {
    backgroundColor: theme.surface,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 10,
  },
  tipsText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});

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
    
    if (cleanName.length > 50) {
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
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.mainContent}
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
              disabled={loading || !name.trim() || name.length > 50 || description.length > 500}
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
                <Text style={styles.label}>Nom de la collection</Text>
                <TextInput
                    style={[
                      styles.textInput,
                      { outlineWidth: 0 },
                      name.length > 50 && { borderColor: '#E53E3E' }
                    ]}
                  value={name}
                  onChangeText={setName} 
                  placeholder="Ex: Vocabulaire anglais, Histoire..."
                  autoFocus
                  editable={!loading}
                  maxLength={100}
                  underlineColorAndroid="transparent"
                  selectionColor="#007AFF"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {name.length > 50 ? (
                    <Text style={{ fontSize: 12, color: '#E53E3E', fontWeight: '500' }}>
                      ⚠️ Le nom ne peut pas dépasser 50 caractères
                    </Text>
                  ) : (
                    <Text />
                  )}
                  <Text style={{ fontSize: 12, color: name.length > 50 ? '#E53E3E' : theme.textSecondary, fontWeight: name.length > 50 ? '600' : '400' }}>
                    {name.length}/50
                  </Text>
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description (optionnel)</Text>
                <TextInput
                  style={[
                    styles.textInput, 
                    styles.textArea, 
                    { outlineWidth: 0 },
                    description.length > 500 && { borderColor: '#E53E3E' }
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Décrivez brièvement le contenu de cette collection..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!loading}
                  maxLength={600}
                  underlineColorAndroid="transparent"
                  selectionColor="#007AFF"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {description.length > 500 ? (
                    <Text style={{ fontSize: 12, color: '#E53E3E', fontWeight: '500' }}>
                      ⚠️ La description ne peut pas dépasser 500 caractères
                    </Text>
                  ) : (
                    <Text />
                  )}
                  <Text style={{ fontSize: 12, color: description.length > 500 ? '#E53E3E' : theme.textSecondary, fontWeight: description.length > 500 ? '600' : '400' }}>
                    {description.length}/500
                  </Text>
                </View>
              </View>

              {/* Sélection de couleur */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Couleur de la bordure</Text>
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
                      { color: name ? theme.text : theme.textMuted, fontStyle: name ? 'normal' : 'italic' }
                    ]}
                      numberOfLines={2}
                      ellipsizeMode='tail'
                    >
                      {name || 'Nom de la collection'}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </View>
                  {(description || !name) && (
                    <Text style={[
                      styles.previewDescription,
                      { color: description ? theme.textSecondary : theme.textMuted, fontStyle: description ? 'normal' : 'italic' }
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
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}