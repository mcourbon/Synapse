// app/review/global.tsx
import { View, Text, StyleSheet, Pressable, Animated, Modal, Alert, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useStats } from '../../contexts/StatsContext';
import { scheduleNext, isDue, getCardMastery, difficultyToEasePercent } from '../../utils/fsrs';
import { StatsTracker } from '../../lib/statsTracker';
import StreakFlame from '../../components/StreakFlame';
import ProfessionalProgressCircle from '../../components/ProfessionalProgressCircle';
import AnimatedSuccessIcon from '../../components/AnimatedSuccessIcon';

// Couleurs hardcodées — module level (iOS safe, jamais dans StyleSheet inside component)
const staticStyles = StyleSheet.create({
  endSessionOverlayLight: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  endSessionOverlayDark: { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  endSessionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default function GlobalReview() {
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [totalCardsReviewed, setTotalCardsReviewed] = useState(0);
  const [streak, setStreak] = useState(0);
  const answeringRef = useRef(false);
  const router = useRouter();
  const { firstCardId } = useLocalSearchParams<{ firstCardId?: string }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { refreshStats } = useStats();
  // Calculé à la main plutôt que délégué à SafeAreaView : cet écran est présenté en
  // presentation:'modal' (react-native-screens), et dans ce contexte-là sur Android,
  // SafeAreaView ne récupère pas l'inset du haut une fois l'edge-to-edge natif actif —
  // le header flottant se retrouvait sous l'encoche caméra / la barre de statut.
  const insets = useSafeAreaInsets();
  const [cardStartTime, setCardStartTime] = useState<Date>(new Date());

  // Animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const borderColorAnimation = useRef(new Animated.Value(0)).current;
  const buttonScaleAnimations = {
    hard: useRef(new Animated.Value(1)).current,
    medium: useRef(new Animated.Value(1)).current,
    easy: useRef(new Animated.Value(1)).current,
  };

  // Animations pour le modal de fin
  const circleProgressAnimation = useRef(new Animated.Value(0)).current;
  const checkScaleAnimation = useRef(new Animated.Value(0)).current;
  const modalBackgroundAnimation = useRef(new Animated.Value(0)).current;
  const modalScaleAnimation = useRef(new Animated.Value(0.8)).current;

  const [isProcessing, setIsProcessing] = useState(false);

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
    floatingHeader: {
      position: 'absolute',
      top: insets.top,
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
    cardScaleWrapper: {
      width: '100%',
      maxWidth: 380,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      width: '100%',
      minHeight: 250,
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
      borderBottomWidth: 8,
      borderBottomColor: theme.primary,
    },
    cardContent: {
      padding: 24,
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
    endSessionTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    endSessionSubtitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    endSessionMessage: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    endSessionButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  });

  useEffect(() => {
    if (user) {
      fetchDueCards();
    }
  }, [user]);


  async function fetchDueCards() {
    if (!user) return;

    try {
      const { data: allCards, error } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id)
        `)
        .eq('decks.user_id', user.id);

      if (error) {
        return;
      }

      if (!allCards) {
        setLoading(false);
        return;
      }

      // Filtrer les cartes dues (incluant les nouvelles cartes)
      const dueCardsList = allCards.filter(card => {
        return isDue(card.next_review);
      });

      if (dueCardsList.length === 0) {
        Alert.alert(
          'Aucune carte à réviser',
          'Toutes vos cartes sont à jour ! Revenez plus tard.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // Mélanger les cartes
      const shuffledCards = [...dueCardsList];
      for (let i = shuffledCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
      }

      // Si on arrive depuis la carte affichée sur la home, elle doit être la première
      // de la session plutôt que de rester à sa place aléatoire post-shuffle.
      if (firstCardId) {
        const firstCardIndex = shuffledCards.findIndex(c => c.id === firstCardId);
        if (firstCardIndex > 0) {
          const [firstCard] = shuffledCards.splice(firstCardIndex, 1);
          shuffledCards.unshift(firstCard);
        }
      }

      setDueCards(shuffledCards);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const handleToggleAnswer = () => {
  if (!showAnswer) {
    // Quand on révèle la réponse, on démarre le timer
    setCardStartTime(new Date());
    setShowAnswer(true);
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }
};

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

  const goToNextCard = () => {
    setCardStartTime(new Date()); // ⭐ RESET LE TIMER
    const nextIndex = currentCardIndex + 1;
    
    if (nextIndex >= dueCards.length) {
      // Session terminée - rafraîchir les stats en arrière-plan
      refreshStats();
      setShowEndSessionModal(true);
      
      // Animations du modal
      Animated.parallel([
        Animated.timing(modalBackgroundAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(modalScaleAnimation, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
      
      setTimeout(() => {
        circleProgressAnimation.setValue(0);
        checkScaleAnimation.setValue(0);
        
        Animated.timing(circleProgressAnimation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }).start();
        
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

    // Passer à la carte suivante
    setCurrentCardIndex(nextIndex);
    setShowAnswer(false);
    setSelectedDifficulty(null);
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);
    
    // Animation d'entrée
    scaleAnimation.setValue(0.8);
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleDifficultyResponse = async (difficulty: 'hard' | 'medium' | 'easy') => {
    if (answeringRef.current || isProcessing || !dueCards[currentCardIndex]) return;
    answeringRef.current = true;

    const card = dueCards[currentCardIndex];
    setSelectedDifficulty(difficulty);
    borderColorAnimation.setValue(1);

    // Streak de réussites d'affilée : "Facile" l'incrémente, "Difficile" le remet à zéro
    if (difficulty === 'easy') {
      setStreak(prev => prev + 1);
    } else if (difficulty === 'hard') {
      setStreak(0);
    }

    if (difficulty !== 'hard') {
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

    const newRepetitions = difficulty === 'hard' ? 0 : (card.repetitions || 0) + 1;

    setIsProcessing(true);
    try {
      const result = scheduleNext(
        {
          stability: card.stability ?? null,
          difficulty: card.difficulty ?? null,
          lastReviewed: card.last_reviewed,
          lapses: card.lapses || 0,
        },
        difficulty
      );

      const { error } = await supabase
        .from('cards')
        .update({
          stability: result.stability,
          difficulty: result.difficulty,
          interval: result.interval,
          repetitions: newRepetitions,
          last_reviewed: result.lastReviewed.toISOString(),
          next_review: result.nextReview.toISOString(),
          lapses: result.lapses,
        })
        .eq('id', card.id);

      if (error) {
        throw new Error('Erreur lors de la mise à jour');
      }

      // Tracker les stats utilisateur
      const studyTime = Math.floor((new Date().getTime() - cardStartTime.getTime()) / 1000);

      await StatsTracker.trackReview({
        userId: user!.id,
        response: difficulty,
        cardId: card.id,
        deckId: card.deck_id,
        studyTime: studyTime,
      });

      setDueCards(prevCards =>
          prevCards.map((c, index) =>
              index === currentCardIndex
              ? {
                  ...c,
                  stability: result.stability,
                  difficulty: result.difficulty,
                  interval: result.interval,
                  repetitions: newRepetitions,
                  last_reviewed: result.lastReviewed.toISOString(),
                  next_review: result.nextReview.toISOString(),
                  lapses: result.lapses,
                  }
              : c
          )
      );

      setTotalCardsReviewed(prev => prev + 1);

      if (difficulty === 'hard') {
        // Pour "hard", rester sur la même carte
        setTimeout(() => {
          setShowAnswer(false);
          setSelectedDifficulty(null);
          fadeAnimation.setValue(0);
          setCardStartTime(new Date());

          Animated.timing(borderColorAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
          answeringRef.current = false;
        }, 1000);
      } else {
        // Pour "medium" et "easy", passer à la suivante
        setTimeout(() => {
          Animated.timing(borderColorAnimation, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }).start();

          Animated.timing(scaleAnimation, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setCardStartTime(new Date());
            goToNextCard();
            answeringRef.current = false;
          });
        }, 500);
      }
    } catch (error) {
      goToNextCard();
      answeringRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = () => {
    Animated.parallel([
      Animated.timing(modalBackgroundAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnimation, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEndSessionModal(false);
      router.back();
    });
  };

  const getTextColor = () => {
    if (selectedDifficulty === 'hard') return '#FF3B30';
    if (selectedDifficulty === 'medium') return '#FF9500';
    if (selectedDifficulty === 'easy') return '#34C759';
    return theme.text;
  };

  const getAnimatedBorderColor = () => {
    if (!selectedDifficulty || !borderColorAnimation) {
      return theme.primary;
    }

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

    if (selectedDifficulty === buttonType) {
      if (buttonType === 'hard') return { backgroundColor: '#FF3B30', borderColor: '#FF3B30' };
      if (buttonType === 'medium') return { backgroundColor: '#FF9500', borderColor: '#FF9500' };
      if (buttonType === 'easy') return { backgroundColor: '#34C759', borderColor: '#34C759' };
    }

    return defaultStyle;
  };

  const getButtonTextColor = (buttonType: 'hard' | 'medium' | 'easy') => {
    if (selectedDifficulty === buttonType) {
      return "#fff";
    }
    return isDark ? '#fff' : '#333';
  };

  const currentCard = dueCards[currentCardIndex];
  const isReady = !loading && !!currentCard;

  return (
    // edges exclut 'top' : le padding du haut est géré à la main via insets.top sur
    // floatingHeader (voir plus haut) plutôt que par SafeAreaView, pour ne pas
    // appliquer l'offset deux fois sur les plateformes où SafeAreaView le gère bien.
    //
    // Le header et ce SafeAreaView restent montés en permanence, chargement inclus :
    // avant, un écran "Chargement..." entièrement séparé (sans header, texte centré)
    // était démonté puis remplacé d'un coup par l'écran complet une fois les cartes
    // prêtes — ce swap d'arbre pendant la transition modale donnait l'effet saccadé.
    // Seul le contenu interne (spinner <-> carte) varie désormais, en fondu léger.
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.floatingHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.deckName}>Révision globale</Text>
          {isReady && (
            <Text style={styles.cardProgress}>
              {currentCardIndex + 1} / {dueCards.length}
            </Text>
          )}
        </View>
        <StreakFlame streak={streak} />
      </View>

      {!isReady ? (
        <View style={styles.mainContent}>
          <View style={[styles.cardContainer, { bottom: 0 }]}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Text style={styles.loadingText}>Aucune carte à réviser</Text>
            )}
          </View>
        </View>
      ) : (
      /* Zone cliquable principale */
      <Pressable
        style={styles.mainContent}
        onPress={handleToggleAnswer}
      >
        <View style={styles.cardContainer}>
          {/* Transform (scale) et borderBottomColor animent chacun sur leur propre
              Animated.View : les mélanger sur le même noeud fait planter Android/Hermes
              ("Attempting to run JS driven animation on animated node that has been
              moved to native") dès qu'on relance l'animation de couleur après un scale
              natif — cf. bug écran gris au clic sur Facile/Moyen. */}
          <Animated.View style={[styles.cardScaleWrapper, { transform: [{ scale: scaleAnimation }] }]}>
            <Animated.View
              style={[
                styles.card,
                { borderBottomColor: getAnimatedBorderColor() }
              ]}
            >
              <View style={styles.cardContent}>
                <View style={styles.questionSection}>
                  <Text style={[styles.cardText, { color: getTextColor() }]}>
                    {currentCard.front}
                  </Text>
                </View>

                {showAnswer && <View style={styles.separator} />}

                {showAnswer && (
                  <Animated.View
                    style={[
                      styles.answerSection,
                      { opacity: fadeAnimation }
                    ]}
                  >
                    <Text style={[styles.cardText, { color: getTextColor() }]}>
                      {currentCard.back}
                    </Text>
                  </Animated.View>
                )}
              </View>
            </Animated.View>
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
                  style={[styles.difficultyButton, getButtonStyle('hard')]}
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
                  style={[styles.difficultyButton, getButtonStyle('medium')]}
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
                  style={[styles.difficultyButton, getButtonStyle('easy')]}
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

            {/* Stats de la carte */}
            <View style={styles.cardStatsContainer}>
             <Text style={styles.cardStatsText}>
                Win Streak: {currentCard.repetitions || 0} •
                Lapses: {currentCard.lapses || 0} •
                Facilité: {difficultyToEasePercent(currentCard.difficulty) ?? '—'}% •
                Statut: {getCardMastery(
                  currentCard.stability,
                  currentCard.difficulty,
                  currentCard.lapses || 0
                )}
              </Text>
            </View>
          </Pressable>
        )}
      </Pressable>
      )}

      {/* Modal de fin de session */}
      <Modal
        visible={showEndSessionModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowEndSessionModal(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Animated.View 
          style={[
            styles.endSessionOverlay,
            isDark ? staticStyles.endSessionOverlayDark : staticStyles.endSessionOverlayLight,
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
            {/* Animation de succès */}
            <View style={styles.iconContainer}>
              <View style={styles.progressCircleContainer}>
                <ProfessionalProgressCircle
                  progress={circleProgressAnimation}
                  size={100}
                  isDark={isDark}
                  showShadow={false}
                  showInnerRing={false}
                />
                <AnimatedSuccessIcon scale={checkScaleAnimation} />
              </View>
            </View>

            <Text style={styles.endSessionTitle}>
              Félicitations !
            </Text>
            
            <Text style={styles.endSessionSubtitle}>
              Session terminée
            </Text>
            
            <Text style={styles.endSessionMessage}>
              Vous avez révisé {totalCardsReviewed} cartes aujourd'hui. Excellent travail !
            </Text>
            
            <Pressable 
              style={styles.endSessionButton}
              onPress={handleEndSession}
            >
              <Text style={staticStyles.endSessionButtonText}>Retour à l'accueil</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}