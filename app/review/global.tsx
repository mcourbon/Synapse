// app/review/global.tsx
import { View, Text, StyleSheet, Pressable, Animated, Modal, Alert } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Card } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useStats } from '../../contexts/StatsContext';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { SpacedRepetitionSystem, useSpacedRepetition } from '../../utils/spacedRepetition';
import Svg, { Circle, LinearGradient, Stop, Defs } from 'react-native-svg';
import { StatsTracker } from '../../lib/statsTracker';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ProfessionalProgressCircle = ({ progress, size = 100, theme }: { progress: Animated.Value, size?: number, theme: any }) => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? "#2a2a2a" : "#f8f9fa"} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.isDark ? "#1a1a1a" : "#e9ecef"} stopOpacity="1" />
          </LinearGradient>
          
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4CAF50" stopOpacity="1" />
            <Stop offset="50%" stopColor="#8BC34A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#CDDC39" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#backgroundGradient)"
          strokeWidth="8"
          fill="none"
        />
        
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
};

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

export default function GlobalReview() {
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [totalCardsReviewed, setTotalCardsReviewed] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { refreshStats } = useStats();
  const [sessionStartTime] = useState(new Date());
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

  const { processReview, isProcessing } = useSpacedRepetition();

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
    endSessionButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });

  useEffect(() => {
    if (user) {
      fetchDueCards();
    }
  }, [user]);

  useFocusEffect(
  React.useCallback(() => {
    // Force immediate header hide
    return () => {};
  }, [])
);

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
        console.error('Erreur:', error);
        return;
      }

      if (!allCards) {
        setLoading(false);
        return;
      }

      // Filtrer les cartes dues (incluant les nouvelles cartes)
      const dueCardsList = allCards.filter(card => {
        return SpacedRepetitionSystem.isDue(card.next_review);
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

      setDueCards(shuffledCards);
    } catch (err) {
      console.error('Erreur:', err);
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
    if (isProcessing || !dueCards[currentCardIndex]) return;

    const card = dueCards[currentCardIndex];
    setSelectedDifficulty(difficulty);
    borderColorAnimation.setValue(1);

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

    const currentStats = {
      interval: card.interval || 1,
      repetitions: card.repetitions || 0,
      easeFactor: card.ease_factor || 2.5,
      lapses: card.lapses || 0,
      lastReviewed: card.last_reviewed ? new Date(card.last_reviewed) : undefined,
      nextReview: card.next_review ? new Date(card.next_review) : undefined,
    };

    const updateCard = async (cardId: string, stats: any) => {
      const { error } = await supabase
        .from('cards')
        .update({
          interval: stats.interval,
          repetitions: stats.repetitions,
          ease_factor: stats.easeFactor,
          last_reviewed: stats.lastReviewed.toISOString(),
          next_review: stats.nextReview.toISOString(),
          lapses: stats.lapses || 0,
        })
        .eq('id', cardId);

      if (error) {
        console.error('Erreur DB:', error);
        throw new Error('Erreur lors de la mise à jour');
      }
    };

    try {
      const result = await processReview(card.id, difficulty, currentStats, updateCard);

      if (result?.success) {
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
                    interval: result.stats?.interval ?? c.interval,
                    repetitions: result.stats?.repetitions ?? c.repetitions,
                    ease_factor: result.stats?.easeFactor ?? c.ease_factor,
                    last_reviewed: result.stats?.lastReviewed?.toISOString() ?? c.last_reviewed,
                    next_review: result.stats?.nextReview?.toISOString() ?? c.next_review,
                    lapses: result.stats?.lapses ?? c.lapses ?? 0,
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
            });
          }, 500);
        }
      } else {
        goToNextCard();
      }
    } catch (error) {
      console.error('Erreur:', error);
      goToNextCard();
    }
  };

  const handleEndSession = () => {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Chargement des cartes à réviser...</Text>
      </SafeAreaView>
    );
  }

  if (dueCards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Aucune carte à réviser</Text>
      </SafeAreaView>
    );
  }

  const currentCard = dueCards[currentCardIndex];

  return (
    <>
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.floatingHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.deckName}>Révision globale</Text>
          <Text style={styles.cardProgress}>
            {currentCardIndex + 1} / {dueCards.length}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Zone cliquable principale */}
      <Pressable 
        style={styles.mainContent} 
        onPress={handleToggleAnswer}
        activeOpacity={1}
      >
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
                Facilité: {((currentCard.ease_factor || 2.5) * 100 - 250).toFixed(0)}% •
                Statut: {SpacedRepetitionSystem.getCardMastery(
                  currentCard.repetitions || 0, 
                  currentCard.ease_factor || 2.5,
                  currentCard.lapses || 0  // ⭐ PASSER LAPSES
                )}
              </Text>
            </View>
          </Pressable>
        )}
      </Pressable>

      {/* Modal de fin de session */}
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
            {/* Animation de succès */}
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
              <Text style={styles.endSessionButtonText}>Retour à l'accueil</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
    </>
  );
}