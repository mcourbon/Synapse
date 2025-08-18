// app/card/[id].tsx
import { View, Text, StyleSheet, Pressable, Animated, Modal, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { SpacedRepetitionSystem, useSpacedRepetition } from '../../utils/spacedRepetition';

export default function CardReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [deckCards, setDeckCards] = useState<Card[]>([]);
  const [deckInfo, setDeckInfo] = useState<{ name: string; id: string } | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  
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
        // Mélanger les cartes pour la révision
        const shuffledCards = [...(allCards || [])];
        
        // Fonction de mélange (Fisher-Yates shuffle)
        for (let i = shuffledCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
        }
        
        // S'assurer que la carte actuelle soit la première de la liste mélangée
        const currentCardIndex = shuffledCards.findIndex(c => c.id === id);
        if (currentCardIndex > 0) {
          // Déplacer la carte actuelle en première position
          const currentCard = shuffledCards[currentCardIndex];
          shuffledCards.splice(currentCardIndex, 1);
          shuffledCards.unshift(currentCard);
        }
        
        setDeckCards(shuffledCards);
        setCurrentCardIndex(0); // Toujours commencer à 0 avec l'ordre mélangé
      }

      setCard(cardData);
      setDeckInfo({ name: cardData.decks.name, id: cardData.decks.id });
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

  // Fonction pour mélanger les cartes
  const shuffleDeckCards = () => {
    const shuffledCards = [...deckCards];
    
    // Fonction de mélange (Fisher-Yates shuffle)
    for (let i = shuffledCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
    }
    
    return shuffledCards;
  };

  // Fonction pour passer à la carte suivante
  const goToNextCard = () => {
    if (deckCards.length <= 1) {
      // S'il n'y a qu'une seule carte, retourner à la vue du deck
      router.back();
      return;
    }

    const nextIndex = currentCardIndex + 1;
    
    // Vérifier si on arrive à la fin du deck
    if (nextIndex >= deckCards.length) {
      // On a fini toutes les cartes - proposer les options
      setShowEndSessionModal(true);
      return;
    }

    // Sinon, continuer normalement
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

  const handleContinueReview = () => {
    // Remélanger les cartes
    const shuffledCards = shuffleDeckCards();
    setDeckCards(shuffledCards);
    
    // Repartir à la première carte
    setCurrentCardIndex(0);
    setCard(shuffledCards[0]);
    
    // Réinitialiser l'état
    setShowAnswer(false);
    setSelectedDifficulty(null);
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);
    
    // Fermer la modal
    setShowEndSessionModal(false);
    
    // Animation d'entrée
    scaleAnimation.setValue(0.8);
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleEndReview = () => {
    setShowEndSessionModal(false);
    router.back();
  };

  const handleDifficultyResponse = async (difficulty: 'hard' | 'medium' | 'easy') => {
    if (isProcessing || !card) return;

    console.log('Bouton cliqué:', difficulty);

    // Changer la couleur du texte immédiatement
    setSelectedDifficulty(difficulty);

    // ANIMATION DE COULEUR POUR TOUS LES BOUTONS
    borderColorAnimation.setValue(1);

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

      if (result?.success && result.stats) {
        console.log('✅ Révision sauvée:', result.message);

        // Mettre à jour la carte en mémoire avec les nouvelles stats
        setCard(prevCard => ({
          ...prevCard!,
          interval: result.stats?.interval,
          repetitions: result.stats?.repetitions,
          ease_factor: result.stats?.easeFactor,
          last_reviewed: result.stats?.lastReviewed?.toISOString() || prevCard!.last_reviewed,
          next_review: result.stats?.nextReview?.toISOString() || prevCard!.next_review,
        }));

        setDeckCards(prevCards => 
          prevCards.map(c => 
            c.id === card.id 
              ? {
                  ...c,
                  interval: result.stats?.interval,
                  repetitions: result.stats?.repetitions,
                  ease_factor: result.stats?.easeFactor,
                  last_reviewed: result.stats?.lastReviewed?.toISOString() || c.last_reviewed,
                  next_review: result.stats?.nextReview?.toISOString() || c.next_review,
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
          <Text style={styles.deckName}>{deckInfo?.name}</Text>
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

      {/* Modal de fin de session */}
      <Modal
        visible={showEndSessionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEndSessionModal(false)}
      >
        <View style={styles.endSessionOverlay}>
          <View style={styles.endSessionModal}>
            {/* Icône avec animation ou alternatives */}
            <View style={styles.iconContainer}>
              {/* Gradient coloré avec check*/}
              <View style={styles.gradientIcon}>
                <Ionicons name="checkmark-circle" size={64} color="#fff" />
              </View>
            </View>

            <Text style={styles.endSessionTitle}>
              Bravo ! 🎉
            </Text>
            
            <Text style={styles.endSessionSubtitle}>
              Vous avez terminé toutes les cartes
            </Text>
            
            <Text style={styles.endSessionMessage}>
              Continuez pour réviser à nouveau ou terminez votre session.
            </Text>
            
            <View style={styles.endSessionButtons}>
              {/* Bouton Terminer */}
              <Pressable 
                style={[styles.endSessionButton, styles.stopButton]}
                onPress={handleEndReview}
              >
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="home-outline" size={22} color="#666" />
                </View>
                <Text style={styles.stopButtonText}>Terminer</Text>
                <Text style={styles.stopButtonSubtext}>Retour au deck</Text>
              </Pressable>
              
              {/* Bouton Continuer */}
              <Pressable 
                style={[styles.endSessionButton, styles.continueButton]}
                onPress={handleContinueReview}
              >
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                </View>
                <Text style={styles.continueButtonText}>Continuer</Text>
                <Text style={styles.continueButtonSubtext}>Remélanger</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
    bottom: 250,
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
    textAlign: 'center',
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
endSessionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  endSessionModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 8,
  },
  gradientIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Pour le web
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  endSessionSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  endSessionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  endSessionMessage: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  endSessionButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 16,
  },
  endSessionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    minHeight: 100,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stopButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  buttonIconContainer: {
    marginBottom: 8,
    padding: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  continueButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    textAlign: 'center',
  },
  stopButtonText: {
    color: '#666',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  stopButtonSubtext: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
});