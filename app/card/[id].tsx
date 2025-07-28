// app/card/[id].tsx
import { View, Text, StyleSheet, Pressable, Alert, Animated } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

export default function CardReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  
  // Animation pour l'apparition de la réponse
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (id && user) {
      fetchCard();
    }
  }, [id, user]);

  async function fetchCard() {
    if (!id || !user) return;

    try {
      const { data, error } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id, name)
        `)
        .eq('id', id)
        .eq('decks.user_id', user.id) // S'assurer que la carte appartient à l'utilisateur
        .single();

      if (error) {
        console.error('Erreur:', error);
        Alert.alert('Erreur', 'Impossible de charger la carte');
        router.back();
        return;
      }

      setCard(data);
    } catch (err) {
      console.error('Erreur:', err);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  const handleToggleAnswer = () => {
    if (!showAnswer) {
      setShowAnswer(true);
      // Animation d'apparition en fade
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Disparition immédiate sans animation
      setShowAnswer(false);
      fadeAnimation.setValue(0);
    }
  };

  const handleDifficultyResponse = (difficulty: 'easy' | 'medium' | 'hard') => {
    // Animation de feedback
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // TODO: Ici vous pourrez implémenter la logique de spaced repetition
    // Mettre à jour les statistiques de la carte selon la difficulté
    
    let message = '';
    switch (difficulty) {
      case 'easy':
        message = 'Parfait ! Cette carte reviendra dans longtemps.';
        break;
      case 'medium':
        message = 'Bien joué ! Cette carte reviendra bientôt.';
        break;
      case 'hard':
        message = 'Pas de souci, cette carte reviendra rapidement.';
        break;
    }

    Alert.alert('Réponse enregistrée', message, [
      {
        text: 'Continuer',
        onPress: () => router.back(), // Retourner à la liste des cartes
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Carte introuvable</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header flottant */}
      <View style={styles.floatingHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.deckName}>{card.decks?.name}</Text>
      </View>

      {/* Container principal - Zone cliquable */}
      <Pressable 
        style={styles.mainContent} 
        onPress={handleToggleAnswer}
        activeOpacity={1}
      >
        {/* Carte principale - toujours centrée */}
        <View style={styles.cardContainer}>
          <Animated.View 
            style={[
              styles.card,
              {
                transform: [{ scale: scaleAnimation }]
              }
            ]}
          >
            <View style={styles.cardContent}>
              {/* Section Question - toujours visible */}
              <View style={styles.questionSection}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLabel}>Question</Text>
                </View>
                <Text style={styles.cardText}>{card.front}</Text>
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
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardLabel}>Réponse</Text>
                  </View>
                  <Text style={styles.cardText}>{card.back}</Text>
                </Animated.View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Boutons de difficulté - empêcher la propagation du clic */}
        {showAnswer && (
          <Pressable 
            style={styles.difficultyContainer}
            onPress={(e) => e.stopPropagation()} // Empêcher la propagation
          >
            <Text style={styles.difficultyTitle}>Comment avez-vous trouvé cette carte ?</Text>
            
            <View style={styles.difficultyButtons}>
              <Pressable 
                style={[styles.difficultyButton, styles.hardButton]}
                onPress={() => handleDifficultyResponse('hard')}
              >
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
                <Text style={styles.difficultyButtonText}>Difficile</Text>
                <Text style={styles.difficultySubtext}>Revoir bientôt</Text>
              </Pressable>

              <Pressable 
                style={[styles.difficultyButton, styles.mediumButton]}
                onPress={() => handleDifficultyResponse('medium')}
              >
                <Ionicons name="remove-circle" size={24} color="#FF9500" />
                <Text style={styles.difficultyButtonText}>Moyen</Text>
                <Text style={styles.difficultySubtext}>Revoir plus tard</Text>
              </Pressable>

              <Pressable 
                style={[styles.difficultyButton, styles.easyButton]}
                onPress={() => handleDifficultyResponse('easy')}
              >
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.difficultyButtonText}>Facile</Text>
                <Text style={styles.difficultySubtext}>Revoir dans longtemps</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      </Pressable>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    zIndex: 10,
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
  deckName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  cardContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 300,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    minHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderBottomWidth: 8,
    borderBottomColor: '#007AFF',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center', // ✅ Centrage vertical du contenu
  },
  questionSection: {
    alignItems: 'center', // ✅ Centrage horizontal
  },
  answerSection: {
    alignItems: 'center', // ✅ Centrage horizontal
  },
  separator: {
    height: 2,
    backgroundColor: '#eee',
    marginVertical: 20,
    borderRadius: 1,
    alignSelf: 'stretch', // ✅ Prend toute la largeur
  },
  cardHeader: {
    marginBottom: 16,
    alignItems: 'center', // ✅ Centrage du label
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    lineHeight: 26,
    textAlign: 'center', // ✅ Centrage du texte
  },
  difficultyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  difficultyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  difficultyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  hardButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FF3B30',
  },
  mediumButton: {
    backgroundColor: '#FFFBF0',
    borderColor: '#FF9500',
  },
  easyButton: {
    backgroundColor: '#F0FFF4',
    borderColor: '#34C759',
  },
  difficultyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  difficultySubtext: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
});