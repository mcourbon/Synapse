// app/card/[id].tsx
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { SpacedRepetitionSystem, useSpacedRepetition, ReviewResponse } from '../../utils/spacedRepetition';

export default function CardReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [deckCards, setDeckCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  
  // Animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const borderColorAnimation = useRef(new Animated.Value(0)).current;
  const buttonScaleAnimations = {
    hard: useRef(new Animated.Value(1)).current,
    medium: useRef(new Animated.Value(1)).current,
    easy: useRef(new Animated.Value(1)).current,
  };

  // Hook pour la répétition espacée
  const { processReview, isProcessing } = useSpacedRepetition();

  useEffect(() => {
    if (id && user) {
      fetchCardAndDeck();
    }
  }, [id, user]);

  async function fetchCardAndDeck() {
    if (!id || !user) return;

    try {
      // Récupérer la carte actuelle et toutes les cartes du deck
      const { data: cardData, error: cardError } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id, name, id)
        `)
        .eq('id', id)
        .eq('decks.user_id', user.id)
        .single();

      if (cardError) {
        console.error('Erreur:', cardError);
        router.back();
        return;
      }

      // Récupérer toutes les cartes du deck
      const { data: allCards, error: allCardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', cardData.decks.id)
        .order('created_at', { ascending: false });

      if (allCardsError) {
        console.error('Erreur cartes deck:', allCardsError);
        setDeckCards([cardData]);
      } else {
        setDeckCards(allCards || []);
        // Trouver l'index de la carte actuelle
        const currentIndex = allCards?.findIndex(c => c.id === id) || 0;
        setCurrentCardIndex(currentIndex);
      }

      setCard(cardData);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleAnswer = () => {
    if (!showAnswer) {
      setShowAnswer(true);
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setShowAnswer(false);
      fadeAnimation.setValue(0);
    }
  };

  // Fonction pour animer un bouton spécifique
  const animateButton = (buttonType: 'hard' | 'medium' | 'easy') => {
    Animated.sequence([
      Animated.timing(buttonScaleAnimations[buttonType], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnimations[buttonType], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fonction pour passer à la carte suivante
  const goToNextCard = () => {
    if (deckCards.length <= 1) {
      // S'il n'y a qu'une seule carte, retourner à la vue du deck
      router.back();
      return;
    }

    const nextIndex = (currentCardIndex + 1) % deckCards.length;
    const nextCard = deckCards[nextIndex];
    
    if (nextCard) {
      // Réinitialiser l'état pour la nouvelle carte
      setShowAnswer(false);
      setSelectedDifficulty(null);
      fadeAnimation.setValue(0);
      borderColorAnimation.setValue(0);
      setCurrentCardIndex(nextIndex);
      setCard(nextCard);
      
      // Animation d'entrée pour la nouvelle carte
      scaleAnimation.setValue(0.8);
      Animated.spring(scaleAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      router.back();
    }
  };

  const handleDifficultyResponse = async (difficulty: 'hard' | 'medium' | 'easy') => {
    if (isProcessing || !card) return;

    console.log('Bouton cliqué:', difficulty);

    // Changer la couleur du texte immédiatement
    setSelectedDifficulty(difficulty);

    // ANIMATION DE COULEUR POUR TOUS LES BOUTONS
    Animated.timing(borderColorAnimation, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false, // false car on anime une propriété non-native (borderColor)
    }).start();

    // Animation additionnelle selon la difficulté
    if (difficulty === 'hard') {
      // Pour "hard", pas d'animation supplémentaire (juste la couleur)
    } else {
      // Animation de feedback rapide sur la carte pour "medium" et "easy"
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 0.95,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Préparer les stats actuelles de la carte
    const currentStats = {
      interval: card.interval || 1,
      repetitions: card.repetitions || 0,
      easeFactor: card.ease_factor || 2.5,
      lastReviewed: card.last_reviewed ? new Date(card.last_reviewed) : undefined,
      nextReview: card.next_review ? new Date(card.next_review) : undefined,
    };

    // Callback pour mettre à jour la base de données
    const updateCard = async (cardId: string, stats: any) => {
      const { error } = await supabase
        .from('cards')
        .update({
          interval: stats.interval,
          repetitions: stats.repetitions,
          ease_factor: stats.easeFactor,
          last_reviewed: stats.lastReviewed.toISOString(),
          next_review: stats.nextReview.toISOString(),
        })
        .eq('id', cardId);

      if (error) {
        console.error('Erreur DB:', error);
        throw new Error('Erreur lors de la mise à jour');
      }
    };

    try {
      // Traiter la révision
      const result = await processReview(card.id, difficulty, currentStats, updateCard);

      if (result?.success) {
        console.log('✅ Révision sauvée:', result.message);

        // Mettre à jour la carte en mémoire avec les nouvelles stats
        setCard(prevCard => ({
          ...prevCard!,
          interval: result.stats.interval,
          repetitions: result.stats.repetitions,
          ease_factor: result.stats.easeFactor,
          last_reviewed: result.stats.lastReviewed?.toISOString() || prevCard!.last_reviewed,
          next_review: result.stats.nextReview?.toISOString() || prevCard!.next_review,
        }));

        setDeckCards(prevCards => 
          prevCards.map(c => 
            c.id === card.id 
              ? {
                  ...c,
                  interval: result.stats.interval,
                  repetitions: result.stats.repetitions,
                  ease_factor: result.stats.easeFactor,
                  last_reviewed: result.stats.lastReviewed?.toISOString() || c.last_reviewed,
                  next_review: result.stats.nextReview?.toISOString() || c.next_review,
                }
              : c
          )
        );

        // Gestion différente selon la difficulté
        if (difficulty === 'hard') {
          // Pour "hard", on reste sur la même carte avec animation de reset
          setTimeout(() => {
            // Reset après 1 secondes
            setShowAnswer(false);
            setSelectedDifficulty(null);
            fadeAnimation.setValue(0);
            
            // Animation de disparition de la bordure rouge
            Animated.timing(borderColorAnimation, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }).start();
          }, 1000);
        } else {
          // Pour "medium" et "easy", passer à la carte suivante après un délai
          setTimeout(() => {
            // Animation de disparition de la bordure colorée
            Animated.timing(borderColorAnimation, {
              toValue: 0,
              duration: 150,
              useNativeDriver: false,
            }).start();

            // Animation de sortie de la carte
            Animated.timing(scaleAnimation, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              goToNextCard();
            });
          }, 500);
        }
      } else {
        console.error('❌ Erreur:', result?.message);
        goToNextCard();
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      goToNextCard();
    }
  };

  // Fonction pour obtenir la couleur du texte selon la difficulté sélectionnée
  const getTextColor = () => {
    if (selectedDifficulty === 'hard') return '#FF3B30';
    if (selectedDifficulty === 'medium') return '#FF9500';
    if (selectedDifficulty === 'easy') return '#34C759';
    return '#333'; // couleur par défaut
  };

  // Fonction pour obtenir la couleur de bordure selon la difficulté sélectionnée
  const getAnimatedBorderColor = () => {
    if (!selectedDifficulty || !borderColorAnimation) {
      // Pas de sélection = bleu par défaut
      return '#007AFF';
    }

    // Animation de la couleur selon la difficulté
    let targetColor = '#007AFF'; // bleu par défaut
    if (selectedDifficulty === 'hard') targetColor = '#FF3B30';
    if (selectedDifficulty === 'medium') targetColor = '#FF9500'; 
    if (selectedDifficulty === 'easy') targetColor = '#34C759';

    return borderColorAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['#007AFF', targetColor], // De bleu vers la couleur sélectionnée
    });
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
        <View style={styles.headerCenter}>
          <Text style={styles.deckName}>{card.decks?.name}</Text>
          {deckCards.length > 1 && (
            <Text style={styles.cardProgress}>
              {currentCardIndex + 1} / {deckCards.length}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
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
                transform: [{ scale: scaleAnimation }],
                borderBottomColor: getAnimatedBorderColor(),
              }
            ]}
          >
            <View style={styles.cardContent}>
              {/* Section Question - toujours visible */}
              <View style={styles.questionSection}>
                <View style={styles.cardHeader}></View>
                <Text style={[styles.cardText, { color: getTextColor() }]}>
                  {card.front}
                </Text>
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
                  <View style={styles.cardHeader}></View>
                  <Text style={[styles.cardText, { color: getTextColor() }]}>
                    {card.back}
                  </Text>
                </Animated.View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Boutons de difficulté */}
        {showAnswer && (
          <Pressable 
            style={styles.difficultyContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.difficultyTitle}>Comment avez-vous trouvé cette carte ?</Text>
            
            <View style={styles.difficultyButtons}>
              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.hard }] }]}>
                <Pressable 
                  style={[styles.difficultyButton, styles.hardButton]}
                  onPress={() => {
                    animateButton('hard');
                    handleDifficultyResponse('hard');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  <Text style={styles.difficultyButtonText}>Difficile</Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.medium }] }]}>
                <Pressable 
                  style={[styles.difficultyButton, styles.mediumButton]}
                  onPress={() => {
                    animateButton('medium');
                    handleDifficultyResponse('medium');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons name="help-circle" size={24} color="#FF9500" />
                  <Text style={styles.difficultyButtonText}>Moyen</Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.easy }] }]}>
                <Pressable 
                  style={[styles.difficultyButton, styles.easyButton]}
                  onPress={() => {
                    animateButton('easy');
                    handleDifficultyResponse('easy');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  <Text style={styles.difficultyButtonText}>Facile</Text>
                </Pressable>
              </Animated.View>
            </View>

            {/* Indicateur de progression */}
            {card && (
              <View style={styles.cardStatsContainer}>
                <Text style={styles.cardStatsText}>
                  Révisions: {card.repetitions || 0} • 
                  Facilité: {((card.ease_factor || 2.5) * 100 - 250).toFixed(0)}% •
                  Statut: {SpacedRepetitionSystem.getCardMastery(
                    card.repetitions || 0, 
                    card.ease_factor || 2.5
                  )}
                </Text>
              </View>
            )}
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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
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
    textAlign: 'center',
  },
  cardProgress: {
    fontSize: 12,
    color: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerSpacer: {
    width: 48, // Même largeur que le bouton back pour centrer
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
    justifyContent: 'center',
  },
  questionSection: {
    alignItems: 'center',
  },
  answerSection: {
    alignItems: 'center',
  },
  separator: {
    height: 2,
    backgroundColor: '#eee',
    marginVertical: 20,
    borderRadius: 1,
    alignSelf: 'stretch',
  },
  cardHeader: {
    marginBottom: 16,
    alignItems: 'center',
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
    lineHeight: 26,
    textAlign: 'center',
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
  buttonWrapper: {
    flex: 1, // Assure que tous les boutons ont la même largeur
  },
  difficultyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 80, // Hauteur minimale fixe pour tous les boutons
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
    textAlign: 'center',
  },
  difficultySubtext: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  cardStatsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cardStatsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});