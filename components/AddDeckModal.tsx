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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AddDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onDeckAdded: () => void;
}

export default function AddDeckModal({ 
  visible, 
  onClose, 
  onDeckAdded 
}: AddDeckModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAddDeck = async () => {
    console.log('=== DÉBUT handleAddDeck ===');
    console.log('Nom:', name);
    console.log('Description:', description);
    console.log('User ID:', user?.id);
    
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un nom à votre collection');
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
        name: name.trim(),
        description: description.trim() || null,
        user_id: user.id // ✅ Utilise le vrai user_id
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
            />
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Aperçu</Text>
            <View style={styles.previewCard}>
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
              <Text style={styles.previewDate}>
                Créé le {new Date().toLocaleDateString('fr-FR')}
              </Text>
            </View>
          </View>

          {/* Tips */}
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>💡 Conseils</Text>
            <Text style={styles.tipsText}>
              • Choisissez un nom descriptif{'\n'}
              • Regroupez les cartes par thème{'\n'}
              • Commencez avec 10-20 cartes maximum
            </Text>
          </View>
        </View>
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
  },
  textArea: {
    minHeight: 100,
  },
  previewSection: {
    marginBottom: 30,
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
    borderWidth: 1,
    borderColor: '#ddd',
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