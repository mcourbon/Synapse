// app/card/[id].tsx
import { View, Text, StyleSheet, Pressable, Animated, Modal, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SpacedRepetitionSystem, useSpacedRepetition } from '../../utils/spacedRepetition';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';

// Composant pour le cercle de progression animé
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Composant d'animation professionnelle avec support thème
const ProfessionalProgressCircle = ({ progress, size = 100, theme }: { progress: Animated.Value, size?: number, theme: any }) => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          {/* Gradient pour le fond - adapté au thème */}
          <LinearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? "#2a2a2a" : "#f8f9fa"} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.isDark ? "#1a1a1a" : "#e9ecef"} stopOpacity="1" />
          </LinearGradient>
          
          {/* Gradient pour la progression */}
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4CAF50" stopOpacity="1" />
            <Stop offset="50%" stopColor="#8BC34A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#CDDC39" stopOpacity="1" />
          </LinearGradient>
          
          {/* Ombre pour la profondeur - adapté au thème */}
          <LinearGradient id="shadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? "#000000" : "#000000"} stopOpacity={theme.isDark ? 0.3 : 0.1} />
            <Stop offset="100%" stopColor={theme.isDark ? "#000000" : "#000000"} stopOpacity={theme.isDark ? 0.1 : 0.05} />
          </LinearGradient>
        </Defs>
        
        {/* Ombre du cercle de fond */}
        <Circle
          cx={size / 2 + 1}
          cy={size / 2 + 1}
          r={radius}
          stroke="url(#shadowGradient)"
          strokeWidth="8"
          fill="none"
          opacity={0.3}
        />
        
        {/* Cercle de fond */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#backgroundGradient)"
          strokeWidth="8"
          fill="none"
        />
        
        {/* Cercle de progression animé */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        
        {/* Cercle intérieur pour l'effet 3D - adapté au thème */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 12}
          stroke={theme.isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.1)"}
          strokeWidth="1"
          fill="none"
        />
      </Svg>
    </View>
  );
};

// Composant pour l'icône de succès animée
const AnimatedSuccessIcon = ({ scale }: { scale: Animated.Value }) => {
  return (
    <Animated.View 
      style={[
        {
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center',
          width: 100,
          height: 100,
        },
        {
          transform: [{ scale }],
        }
      ]}
    >
      <View style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}>
        <Ionicons name="checkmark" size={32} color="#fff" />
      </View>
    </Animated.View>
  );
};

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
  const { theme, isDark } = useTheme();
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

  // Animations pour le modal de fin - améliorées
  const circleProgressAnimation = useRef(new Animated.Value(0)).current;
  const checkScaleAnimation = useRef(new Animated.Value(0)).current;
  const modalBackgroundAnimation = useRef(new Animated.Value(0)).current;
  const modalScaleAnimation = useRef(new Animated.Value(0.8)).current;

  // Hook pour la répétition espacée
  const { processReview, isProcessing } = useSpacedRepetition();

  // StyleSheet utilisant le thème complet
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      textAlign: 'center',
      fontSize: 18,
      color: theme.textSecondary,
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 5,
      paddingBottom: 15,
      zIndex: 10,
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginTop: 15,
    },
    headerCenter: {
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 16,
      marginTop: 15,
    },
    deckName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      textAlign: 'center',
    },
    cardProgress: {
      fontSize: 12,
      color: theme.textSecondary,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 4,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    headerSpacer: {
      width: 48,
    },
    mainContent: {
      flex: 1,
      position: 'relative',
      width: '100%',
      maxWidth: 500,
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
      backgroundColor: theme.surface,
      borderRadius: 20,
      width: '100%',
      maxWidth: 380,
      minHeight: 250,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
      borderBottomWidth: 8,
      borderBottomColor: theme.primary,
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
      backgroundColor: theme.border,
      marginVertical: 20,
      borderRadius: 1,
      alignSelf: 'stretch',
    },
    cardText: {
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 26,
      textAlign: 'center',
      color: theme.text,
    },
    difficultyContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingVertical: 24,
      alignSelf: 'center',
      maxWidth: 500,
    },
    difficultyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    difficultyButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    buttonWrapper: {
      flex: 1,
    },
    difficultyButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 2,
      minHeight: 80,
    },
    difficultyButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      marginTop: 8,
      textAlign: 'center',
    },
    cardStatsContainer: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cardStatsText: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    endSessionOverlay: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    endSessionModal: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 32,
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 16,
    },
    iconContainer: {
      marginBottom: 24,
      padding: 8,
    },
    progressCircleContainer: {
      width: 100,
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    endSessionSubtitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    endSessionTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    endSessionMessage: {
      fontSize: 15,
      color: theme.textSecondary,
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
      backgroundColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    stopButton: {
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
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
      color: theme.textSecondary,
      fontSize: 17,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    stopButtonSubtext: {
      color: theme.textSecondary,
      fontSize: 13,
      textAlign: 'center',
    },
  });

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
      // On a fini toutes les cartes - proposer les options avec animation professionnelle
      setShowEndSessionModal(true);
      
      // Animation d'entrée du modal
      Animated.parallel([
        Animated.timing(modalBackgroundAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalScaleAnimation, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Démarrer l'animation du cercle de progression après un délai
      setTimeout(() => {
        // Reset des animations
        circleProgressAnimation.setValue(0);
        checkScaleAnimation.setValue(0);
        
        // Animation du cercle de progression (2.5 secondes avec easing)
        Animated.timing(circleProgressAnimation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }).start();
        
        // Animation du check qui apparaît après 2 secondes
        setTimeout(() => {
          Animated.spring(checkScaleAnimation, {
            toValue: 1,
            tension: 150,
            friction: 6,
            useNativeDriver: true,
          }).start();
        }, 2000);
      }, 400);
      
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
    
    // Reset des animations du modal
    circleProgressAnimation.setValue(0);
    checkScaleAnimation.setValue(0);
    modalBackgroundAnimation.setValue(0);
    modalScaleAnimation.setValue(0.8);
    
    // Fermer la modal avec animation
    Animated.parallel([
      Animated.timing(modalBackgroundAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnimation, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEndSessionModal(false);
    });
    
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
    // Animation de sortie du modal
    Animated.parallel([
      Animated.timing(modalBackgroundAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnimation, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset des animations du modal
      circleProgressAnimation.setValue(0);
      checkScaleAnimation.setValue(0);
      modalBackgroundAnimation.setValue(0);
      modalScaleAnimation.setValue(0.8);
      setShowEndSessionModal(false);
      
      // Utiliser setTimeout pour s'assurer que la navigation se fait après la fermeture du modal
      setTimeout(() => {
        router.back();
      }, 50);
    });
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
    return theme.text;
  };

  // Fonction pour obtenir la couleur de bordure selon la difficulté sélectionnée
  const getAnimatedBorderColor = () => {
    if (!selectedDifficulty || !borderColorAnimation) {
      // Pas de sélection = couleur primaire du thème
      return theme.primary;
    }

    // Animation de la couleur selon la difficulté
    let targetColor = theme.primary;
    if (selectedDifficulty === 'hard') targetColor = '#FF3B30';
    if (selectedDifficulty === 'medium') targetColor = '#FF9500'; 
    if (selectedDifficulty === 'easy') targetColor = '#34C759';

    return borderColorAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.primary, targetColor],
    });
  };

  const getButtonStyle = (buttonType: 'hard' | 'medium' | 'easy') => {
    // Styles par défaut adaptés au thème
    let defaultStyle = {};
    if (buttonType === 'hard') defaultStyle = { 
      backgroundColor: isDark ? '#4A1A1A' : '#FFF5F5', 
      borderColor: '#FF3B30' 
    };
    if (buttonType === 'medium') defaultStyle = { 
      backgroundColor: isDark ? '#4A2A0F' : '#FFFBF0', 
      borderColor: '#FF9500' 
    };
    if (buttonType === 'easy') defaultStyle = { 
      backgroundColor: isDark ? '#1A3A1A' : '#F0FFF4', 
      borderColor: '#34C759' 
    };

    // Si ce bouton est sélectionné, utiliser la couleur pleine
    if (selectedDifficulty === buttonType) {
      if (buttonType === 'hard') return { backgroundColor: '#FF3B30', borderColor: '#FF3B30' };
      if (buttonType === 'medium') return { backgroundColor: '#FF9500', borderColor: '#FF9500' };
      if (buttonType === 'easy') return { backgroundColor: '#34C759', borderColor: '#34C759' };
    }

    return defaultStyle;
  };

  

const getButtonTextColor = (buttonType: 'hard' | 'medium' | 'easy') => {
  // Si le bouton est sélectionné, texte blanc
  if (selectedDifficulty === buttonType) {
    return "#fff";
  }
  
  // Sinon, couleur adaptée au thème
  return isDark ? '#fff' : '#333';
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
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
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
                  style={[
                    styles.difficultyButton, 
                    getButtonStyle('hard')
                  ]}
                  onPress={() => {
                    animateButton('hard');
                    handleDifficultyResponse('hard');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={24} 
                    color={selectedDifficulty === 'hard' ? "#fff" : "#FF3B30"}
                  />
                  <Text style={[
                    styles.difficultyButtonText,
                    { color: getButtonTextColor('hard') }
                  ]}>
                    Difficile
                  </Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.medium }] }]}>
                <Pressable 
                  style={[
                    styles.difficultyButton, 
                    getButtonStyle('medium')
                  ]}
                  onPress={() => {
                    animateButton('medium');
                    handleDifficultyResponse('medium');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons 
                    name="help-circle" 
                    size={24} 
                    color={selectedDifficulty === 'medium' ? "#fff" : "#FF9500"}
                  />
                  <Text style={[
                    styles.difficultyButtonText,
                    { color: getButtonTextColor('medium') }
                  ]}>
                    Moyen
                  </Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnimations.easy }] }]}>
                <Pressable 
                  style={[
                    styles.difficultyButton, 
                    getButtonStyle('easy')
                  ]}
                  onPress={() => {
                    animateButton('easy');
                    handleDifficultyResponse('easy');
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons 
                    name="checkmark-circle" 
                    size={24} 
                    color={selectedDifficulty === 'easy' ? "#fff" : "#34C759"}
                  />
                  <Text style={[
                    styles.difficultyButtonText,
                    { color: getButtonTextColor('easy') }
                  ]}>
                    Facile
                  </Text>
                </Pressable>
              </Animated.View>
            </View>

            {/* Indicateur de progression */}
            {card && (
              <View style={styles.cardStatsContainer}>
                <Text style={styles.cardStatsText}>
                  Win Streak: {card.repetitions || 0} • 
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

      {/* Modal de fin de session améliorée */}
      <Modal
        visible={showEndSessionModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowEndSessionModal(false)}
      >
        <Animated.View 
          style={[
            styles.endSessionOverlay,
            {
              opacity: modalBackgroundAnimation,
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.endSessionModal,
              {
                transform: [{ scale: modalScaleAnimation }],
              }
            ]}
          >
            {/* Animation professionnelle avec cercle et icône */}
            <View style={styles.iconContainer}>
              <View style={styles.progressCircleContainer}>
                <ProfessionalProgressCircle 
                  progress={circleProgressAnimation} 
                  size={100} 
                  theme={theme}
                />
                <AnimatedSuccessIcon scale={checkScaleAnimation} />
              </View>
            </View>

            <Text style={styles.endSessionTitle}>
              Bravo !
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
                  <Ionicons name="home-outline" size={22} color={theme.textSecondary} />
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
          </Animated.View>
        </Animated.View>
      </Modal>

    </SafeAreaView>
  );
}