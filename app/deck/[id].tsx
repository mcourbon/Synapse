// app/deck/[id].tsx
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card, Deck } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

export default function DeckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [addingCard, setAddingCard] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

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
        .eq('user_id', user.id) // S'assurer que c'est le deck de l'utilisateur
        .single();

      if (deckError) {
        console.error('Erreur deck:', deckError);
        Alert.alert('Erreur', 'Impossible de charger le deck');
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
        Alert.alert('Erreur', 'Impossible de charger les cartes');
      } else {
        setCards(cardsData || []);
      }

      setDeck(deckData);
    } catch (err) {
      console.error('Erreur:', err);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  const handleStartReview = () => {
    if (cards.length === 0) {
      Alert.alert('Aucune carte', 'Ce deck ne contient aucune carte à réviser');
      return;
    }
    
    // Prendre une carte aléatoire ou la première
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    router.push(`/card/${randomCard.id}`);
  };

  const handleAddCard = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le recto et le verso');
      return;
    }

    if (!id || !user) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la carte');
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
          }
        ]);

      if (error) {
        throw error;
      }

      // Réinitialiser les champs
      setFront('');
      setBack('');
      setShowAddModal(false);
      
      Alert.alert('Succès', 'Carte ajoutée avec succès !');
      
      // Rafraîchir la liste des cartes
      fetchDeckAndCards();
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la carte');
    } finally {
      setAddingCard(false);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setFront('');
    setBack('');
  };

  const renderCard = ({ item }: { item: Card }) => (
    <Pressable 
      style={styles.cardItem}
      onPress={() => router.push(`/card/${item.id}`)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardFront} numberOfLines={2}>
          {item.front}
        </Text>
        <Text style={styles.cardBack} numberOfLines={2}>
          {item.back}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!deck) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Deck introuvable</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header amélioré */}
      <View style={styles.floatingHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{deck.name}</Text>
        <View style={{ width: 48 }} />
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

      {/* Modal d'ajout de carte */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header de la modal */}
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
              <Text style={styles.label}>Recto (Question)</Text>
              <TextInput
                style={styles.textInput}
                value={front}
                onChangeText={setFront}
                placeholder="Tapez votre question..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verso (Réponse)</Text>
              <TextInput
                style={styles.textInput}
                value={back}
                onChangeText={setBack}
                placeholder="Tapez votre réponse..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
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
  // Styles pour la modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
});