import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Card, Deck } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateDeckForm, setShowCreateDeckForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');

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

  async function fetchRandomCard() {
    if (!user) return;

    try {
      // Récupérer les cartes de l'utilisateur connecté uniquement
      const { data: userCards, error } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id)
        `)
        .eq('decks.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10); // Prendre plus de cartes pour faire un vrai random

      if (error) {
        console.error('Erreur lors de la récupération des cartes:', error);
        return;
      }

      if (userCards && userCards.length > 0) {
        // Sélectionner une carte aléatoire parmi celles de l'utilisateur
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
        .eq('user_id', user.id) // ✅ Filtrer par utilisateur connecté
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

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un nom à votre deck');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour créer un deck');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('decks')
        .insert([
          {
            name: newDeckName.trim(),
            description: newDeckDescription.trim() || null,
            user_id: user.id, // ✅ Associer le deck à l'utilisateur connecté
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Ajouter le nouveau deck à la liste et le sélectionner
      setDecks([data, ...decks]);
      setSelectedDeckId(data.id);
      
      // Réinitialiser le formulaire de création
      setNewDeckName('');
      setNewDeckDescription('');
      setShowCreateDeckForm(false);
      
      Alert.alert('Succès', 'Deck créé avec succès !');
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible de créer le deck');
    } finally {
      setLoading(false);
    }
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
          }
        ]);

      if (error) {
        throw error;
      }

      // Réinitialiser les champs
      setFront('');
      setBack('');
      
      Alert.alert('Succès', 'Carte ajoutée avec succès !');
      closeModal();
      
      // Rafraîchir la carte affichée
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
    setSelectedDeckId('');
    setShowCreateDeckForm(false);
    setNewDeckName('');
    setNewDeckDescription('');
  };

  const openQuickAdd = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour ajouter des cartes');
      return;
    }
    setShowQuickAddModal(true);
  };

  // Message de bienvenue personnalisé
  const getWelcomeMessage = () => {
    if (!user) return 'Bienvenue !';
    
    const hour = new Date().getHours();
    let greeting = 'Bonsoir';
    
    if (hour < 12) greeting = 'Bonjour';
    else if (hour < 18) greeting = 'Bel après-midi';
    
    // Extraire le prénom de l'email (partie avant @)
    const firstName = user.email?.split('@')[0] || 'Utilisateur';
    
    return `${greeting}, ${firstName} !`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Flashcard en fond façon Tinycards */}
      <View style={styles.tinycardWrapper}>
        <Pressable
          style={styles.tinycard}
          onPress={() => {/* action future : révision, détail, etc. */}}
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
          <Ionicons name="albums" size={28} color="#007AFF" />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={28} color="#007AFF" />
        </Pressable>
      </View>

      {/* Bouton flottant d'ajout rapide */}
      <Pressable style={styles.fab} onPress={openQuickAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Modal d'ajout rapide */}
      <Modal
        visible={showQuickAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal}>
              <Text style={styles.cancelButton}>Annuler</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Ajout rapide</Text>
            <Pressable 
              onPress={showCreateDeckForm ? handleCreateDeck : handleAddCard}
              disabled={loading}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
                {loading ? 'Ajout...' : (showCreateDeckForm ? 'Créer' : 'Ajouter')}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Sélection/Création de deck */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deck de destination</Text>
              
              {decks.length === 0 || showCreateDeckForm ? (
                // Formulaire de création de deck
                <View>
                  <TextInput
                    style={styles.textInput}
                    value={newDeckName}
                    onChangeText={setNewDeckName}
                    placeholder="Nom du nouveau deck"
                    autoFocus={decks.length === 0}
                  />
                  <TextInput
                    style={[styles.textInput, styles.textArea, { marginTop: 10 }]}
                    value={newDeckDescription}
                    onChangeText={setNewDeckDescription}
                    placeholder="Description (optionnel)"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {decks.length > 0 && (
                    <Pressable 
                      style={styles.switchButton}
                      onPress={() => setShowCreateDeckForm(false)}
                    >
                      <Text style={styles.switchButtonText}>Utiliser un deck existant</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                // Sélection de deck existant
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
                    onPress={() => setShowCreateDeckForm(true)}
                  >
                    <Ionicons name="add" size={16} color="#007AFF" />
                    <Text style={styles.switchButtonText}>Créer un nouveau deck</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Formulaire de carte (seulement si on n'est pas en train de créer un deck) */}
            {!showCreateDeckForm && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recto</Text>
                  <TextInput
                    style={styles.textInput}
                    value={front}
                    onChangeText={setFront}
                    placeholder="Tapez votre question..."
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Verso</Text>
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
              </>
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
    backgroundColor: '#fff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
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
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 320,      // ✅ Augmenté de 320 à 380
    maxWidth: '90%',    // ✅ Ajouté pour éviter le débordement sur petits écrans
    aspectRatio: 5/3,   // ✅ Changé de 16/9 à 5/3 pour un format plus carré
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },     // ✅ Ombre plus prononcée
    shadowOpacity: 0.2,                        // ✅ Ombre plus visible
    shadowRadius: 16,                          // ✅ Ombre plus diffuse
    elevation: 12,                             // ✅ Élévation plus importante sur Android
    marginBottom: 28,
    overflow: 'hidden',
    zIndex: 2,
    position: 'relative',
    borderBottomWidth: 12,                      // ✅ Bordure plus épaisse (4 → 12)
    borderBottomColor: '#007AFF',              // ✅ Couleur bleue cohérente avec l'app
  },
  
  tinycardText: {
    color: '#222',
    fontSize: 24,    // ✅ Texte légèrement plus grand (22 → 24)
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.3,  // ✅ Espacement des lettres légèrement augmenté
    lineHeight: 32,      // ✅ Ajout d'un line-height pour une meilleure lisibilité
    zIndex: 2,
    paddingHorizontal: 32, // ✅ Padding horizontal augmenté (24 → 32)
  },
  welcomeOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
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
  },
  textArea: {
    minHeight: 100,
  },
  deckSelector: {
    marginBottom: 10,
  },
  deckOption: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deckOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  deckOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
    color: '#007AFF',
    fontWeight: '500',
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