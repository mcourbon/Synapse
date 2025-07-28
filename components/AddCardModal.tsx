// components/AddCardModal.tsx
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
  const [loading, setLoading] = useState(false);

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
          }
        ]);

      if (error) {
        throw error;
      }

      // Réinitialiser les champs
      setQuestion('');
      setAnswer('');
      
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
        <View style={styles.form}>
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

          {/* Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Aperçu</Text>
            <View style={styles.previewCards}>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Recto</Text>
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
    minHeight: 100,
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
    fontStyle: 'normal',
  },
});