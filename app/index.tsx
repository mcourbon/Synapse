import { View, Text, StyleSheet, Pressable, Alert, Animated, Modal, ActivityIndicator, Easing, BackHandler, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Card } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import AddCardModal from '../components/AddCardModal';
import { useTheme } from '../contexts/ThemeContext';
import { useStats } from '../contexts/StatsContext';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { scheduleNext, isDue, getCardMastery, difficultyToEasePercent } from '../utils/fsrs';
import { StatsTracker } from '../lib/statsTracker';
import StreakFlame from '../components/StreakFlame';
import ProfessionalProgressCircle from '../components/ProfessionalProgressCircle';
import AnimatedSuccessIcon from '../components/AnimatedSuccessIcon';

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

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { refreshStats } = useStats();

  // ---- Écran d'accueil ----
  const [homeCard, setHomeCard] = useState<Card | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [totalCardsCount, setTotalCardsCount] = useState<number>(0);

  // ---- Mode accueil <-> révision ----
  // Anciennement une vraie navigation vers /review/global (presentation: 'modal').
  // Le passage entre les deux se fait maintenant SUR LE MÊME ÉCRAN, sans jamais
  // pousser de route : plus de transition native (modal ou push) à combattre, donc
  // plus de flash noir ni de glissement parasite au tap sur la tinycard — la carte
  // qui s'affiche est littéralement le même composant, on anime juste sa forme et
  // le chrome autour. Voir git history pour tout ce qui a été tenté côté navigation
  // native avant ce choix (fade, slide_from_bottom, animation: 'none', retrait du
  // modal — rien n'a marché, la seule vraie solution était de ne plus naviguer).
  const [mode, setMode] = useState<'home' | 'review'>('home');
  const transitionAnim = useRef(new Animated.Value(0)).current; // 0 = look accueil, 1 = look révision

  // ---- Session de révision (fusionné depuis l'ex app/review/global.tsx) ----
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'medium' | 'easy' | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [totalCardsReviewed, setTotalCardsReviewed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardStartTime, setCardStartTime] = useState<Date>(new Date());
  const answeringRef = useRef(false);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const borderColorAnimation = useRef(new Animated.Value(0)).current;
  const buttonScaleAnimations = {
    hard: useRef(new Animated.Value(1)).current,
    medium: useRef(new Animated.Value(1)).current,
    easy: useRef(new Animated.Value(1)).current,
  };
  const circleProgressAnimation = useRef(new Animated.Value(0)).current;
  const checkScaleAnimation = useRef(new Animated.Value(0)).current;
  const modalBackgroundAnimation = useRef(new Animated.Value(0)).current;
  const modalScaleAnimation = useRef(new Animated.Value(0.8)).current;

  // Espacements verticaux dérivés de la hauteur d'écran plutôt que des px fixes —
  // sinon la zone réservée en bas pour les boutons de difficulté (ex: 220px en dur)
  // ou le point de départ de la tapZone/welcomeOverlay (ex: top:100 en dur) mangent
  // une part disproportionnée de l'écran sur un petit tel (iPhone SE, Android
  // compact) et laissent un vide exagéré sur un grand écran. Bornes min/max pour
  // rester raisonnable aux deux extrêmes ; les valeurs par défaut (100 / 220) sont
  // calées pour tomber ~pareil sur un gabarit "normal" (~850dp de haut), donc pas
  // de changement visible sur les tels déjà testés.
  const { height: screenHeight } = useWindowDimensions();
  const topOffset = Math.round(Math.min(120, Math.max(80, screenHeight * 0.115)));
  const difficultyReserve = Math.round(Math.min(260, Math.max(190, screenHeight * 0.26)));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    mainContent: {
      flex: 1,
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      position: 'relative',
    },
    topBar: {
      position: 'absolute',
      top: 0,
      width: '100%',
      paddingHorizontal: 20,
      marginTop: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      zIndex: 10,
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${theme.surface}dd`,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    iconLayer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 12,
    },
    tapZone: {
      // Toute cette zone (sous la topBar, jusqu'en bas) retourne la carte au tap —
      // pas seulement la carte elle-même : le centre, les côtés, le dessous, tout
      // déclenche la même action, en accueil comme en révision.
      position: 'absolute',
      top: topOffset,
      left: 0,
      right: 0,
      bottom: 0,
    },
    cardZone: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    cardScaleWrapper: {
      width: '90%',
      maxWidth: 380,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
      overflow: 'hidden',
    },
    cardContent: {
      padding: 24,
    },
    separator: {
      height: 2,
      backgroundColor: theme.border,
      marginVertical: 20,
      borderRadius: 1,
      alignSelf: 'stretch',
    },
    cardText: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 27,
      textAlign: 'center',
      color: theme.text,
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
    welcomeOverlay: {
      position: 'absolute',
      top: topOffset,
      left: 20,
      right: 20,
      alignItems: 'center',
    },
    welcomeText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      backgroundColor: `${theme.surface}f2`,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginHorizontal: 20,
      overflow: 'hidden',
    },
    reviewTitleText: {
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
      overflow: 'hidden',
    },
    reviewCounterText: {
      fontSize: 12,
      color: theme.textSecondary,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 6,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      overflow: 'hidden',
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
      width: '100%',
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
    fab: {
      position: 'absolute',
      bottom: 30,
      right: 30,
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
    loadingText: {
      textAlign: 'center',
      fontSize: 18,
      color: theme.textSecondary,
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

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        updateHomeScreenCard();
        fetchTotalCardsCount();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      updateHomeScreenCard();
      fetchTotalCardsCount();
    }
  }, [user]);

  // Bouton retour matériel Android : en révision, on revient à l'accueil plutôt que
  // de quitter l'app (il n'y a pas de route empilée à dépiler, tout se passe sur cet
  // écran). Ne s'active jamais hors du mode révision.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'review') {
        exitReview();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function updateHomeScreenCard() {
    if (!user) return;

    try {
      // On réutilise la fonction qui cherche les cartes dues
      const dueCards = await fetchAllDueCards();

      if (dueCards && dueCards.length > 0) {
        // S'il y a des cartes à réviser, on en choisit une au hasard
        const randomIndex = Math.floor(Math.random() * dueCards.length);
        setHomeCard(dueCards[randomIndex]);
      } else {
        // S'il n'y a AUCUNE carte à réviser, on met l'état à null
        setHomeCard(null);
      }
    } catch (err) {
      setHomeCard(null); // En cas d'erreur, on n'affiche rien non plus
    }
  }

  // Récupère toutes les cartes dues, utilisée à la fois pour la tinycard d'accueil
  // et pour construire la file de la session de révision.
  async function fetchAllDueCards() {
    if (!user) return [];

    try {
      const { data: allCards, error } = await supabase
        .from('cards')
        .select(`
          *,
          decks!inner(user_id)
        `)
        .eq('decks.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return [];
      }

      if (!allCards) return [];

      // Filtrer les cartes dues
      const dueCards = allCards.filter(card => {
        return isDue(card.next_review);
      });

      return dueCards;
    } catch (err) {
      return [];
    }
  }

  async function fetchTotalCardsCount() {
    if (!user) return;

    try {
      // On utilise { count: 'exact', head: true } pour être plus performant.
      // On ne récupère que le compte, pas les données des cartes.
      const { count, error } = await supabase
        .from('cards')
        .select('id, decks!inner(user_id)', { count: 'exact', head: true })
        .eq('decks.user_id', user.id);

      if (error) {
        return;
      }

      setTotalCardsCount(count || 0);
    } catch {
    }
  }

  const openQuickAdd = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour ajouter des cartes');
      return;
    }
    setShowQuickAddModal(true);
  };

  const motivationalMessages = [
    "Prêt à apprendre quelque chose de nouveau ?",
    "Chaque carte révisée vous rapproche de vos objectifs !",
    "L'apprentissage est un voyage, pas une destination",
    "Votre cerveau est votre meilleur allié",
    "Aujourd'hui est le jour parfait pour réviser !",
    "La connaissance est le pouvoir le plus précieux",
    "Transformez vos minutes en moments d'apprentissage",
    "Chaque révision compte, continuez comme ça !",
    "Votre future version vous remerciera",
    "L'excellence est une habitude, pas un accident",
    "Apprenez aujourd'hui, brillez demain !",
    "Votre potentiel est illimité",
    "La répétition est la mère de l'apprentissage",
    "Investissez en vous, c'est le meilleur placement !",
    "Petit à petit, l'oiseau fait son nid",
    "Votre détermination vous mènera loin",
    "Chaque expert était autrefois un débutant",
    "L'apprentissage n'a pas d'âge limite",
    "Transformez votre curiosité en connaissance",
    "Vous êtes capable de plus que vous ne le pensez !"
  ];

  const getWelcomeMessage = () => {
    if (!user) return 'Bienvenue sur votre app de révision !';

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const hourBlock = Math.floor(now.getHours() / 4);
    const index = (dayOfYear + hourBlock) % motivationalMessages.length;

    return motivationalMessages[index];
  };

  const getCardTextMessage = () => {
    // Cas 1: Il y a une carte à réviser
    if (homeCard) {
      return homeCard.front;
    }
    // Cas 2: Il n'y a pas de carte à réviser, mais l'utilisateur a déjà créé des cartes
    if (totalCardsCount > 0) {
      return "Toutes vos cartes sont à jour !";
    }
    // Cas 3: L'utilisateur n'a encore jamais créé de carte
    return "Commencez par créer votre premier deck !";
  };

  // ---- Transition accueil -> révision ----
  // La carte affichée montre déjà le texte de homeCard : comme cette carte devient
  // la première de la session (voir plus bas), son texte ne change pas au moment du
  // switch — inutile de le faire fondre, seuls le chrome autour (topBar, bandeau du
  // haut) et la forme/position de la carte s'animent.
  const handleHomeCardPress = async () => {
    const cards = await fetchAllDueCards();
    if (cards.length === 0) {
      Alert.alert('Aucune carte due', 'Toutes vos cartes sont à jour ! Revenez plus tard.');
      return;
    }
    startReviewSession(cards);
  };

  const startReviewSession = (cards: Card[]) => {
    // Mélanger les cartes
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // La carte déjà affichée sur l'accueil doit rester la première de la session
    // plutôt que de se retrouver à sa place aléatoire post-mélange.
    if (homeCard) {
      const idx = shuffled.findIndex(c => c.id === homeCard.id);
      if (idx > 0) {
        const [first] = shuffled.splice(idx, 1);
        shuffled.unshift(first);
      }
    }

    setDueCards(shuffled);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedDifficulty(null);
    setTotalCardsReviewed(0);
    setStreak(0);
    setCardStartTime(new Date());
    fadeAnimation.setValue(0);
    borderColorAnimation.setValue(0);
    scaleAnimation.setValue(1);
    setMode('review');

    Animated.timing(transitionAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // anime aussi top/bottom/borderWidth, pas juste transform/opacity
    }).start();
  };

  const exitReview = () => {
    Animated.timing(transitionAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setMode('home');
      setDueCards([]);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setSelectedDifficulty(null);
      updateHomeScreenCard();
      fetchTotalCardsCount();
    });
  };

  const handleToggleAnswer = () => {
    if (mode !== 'review' || showAnswer) return;
    // Quand on révèle la réponse, on démarre le timer
    setCardStartTime(new Date());
    setShowAnswer(true);
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
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
      exitReview();
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
  const isReviewReady = mode === 'review' && !!currentCard;

  // Opacités croisées pilotées par une seule Animated.Value (transitionAnim) : pas
  // de useNativeDriver possible ici car elle anime aussi des props de layout
  // (top/bottom/borderWidth) plus bas, donc tout ce qui la consomme tourne côté JS —
  // acceptable pour une transition ponctuelle de ~350ms.
  const homeLayerOpacity = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const reviewLayerOpacity = transitionAnim;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Bar en haut : décks<->retour, profil<->streak, fondu croisé */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => (mode === 'home' ? router.push('/decks') : exitReview())}
          >
            <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, { opacity: homeLayerOpacity }]}>
              <Ionicons name="albums" size={28} color={theme.primary} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, { opacity: reviewLayerOpacity }]}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </Animated.View>
          </Pressable>

          {/* Titre "Révision globale" + compteur, aligné avec les boutons de la
              topBar (comme dans l'ancien header de review/global.tsx) — pas dans le
              bandeau plus bas, qui ne sert qu'au message motivant de l'accueil. */}
          <Animated.View style={[styles.headerCenter, { opacity: reviewLayerOpacity }]} pointerEvents="none">
            <Text style={styles.reviewTitleText}>Révision globale</Text>
            {isReviewReady && (
              <Text style={styles.reviewCounterText}>
                {currentCardIndex + 1} / {dueCards.length}
              </Text>
            )}
          </Animated.View>

          {/* Conteneur neutre (sans fond propre) : chaque calque porte son propre
              habillage — le bouton profil reprend iconButton, StreakFlame garde son
              chip déjà stylé, pas d'empilement de deux fonds l'un dans l'autre. */}
          <View style={{ width: 48, height: 48 }}>
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.iconButton, styles.iconLayer, { opacity: homeLayerOpacity }]}
              pointerEvents={mode === 'home' ? 'auto' : 'none'}
            >
              <Pressable onPress={() => router.push('/profile')} hitSlop={12}>
                <Ionicons name="person" size={28} color={theme.primary} />
              </Pressable>
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.iconLayer, { opacity: reviewLayerOpacity }]}
              pointerEvents="none"
            >
              <StreakFlame streak={streak} />
            </Animated.View>
          </View>
        </View>

        {/* Bandeau du haut : message motivant de l'accueil, fondu au noir en révision */}
        <View style={styles.welcomeOverlay}>
          <Animated.View style={{ opacity: homeLayerOpacity }} pointerEvents="none">
            <Text style={styles.welcomeText}>{getWelcomeMessage()}</Text>
          </Animated.View>
        </View>

        {/* Zone cliquable : n'importe où sous le bandeau du haut (pas seulement la
            carte) retourne la carte à l'accueil, ou révèle la réponse en révision.
            La carte elle-même n'a plus son propre Pressable — purement visuelle,
            pointerEvents 'none' pour laisser passer le tap jusqu'ici. */}
        <Pressable
          style={styles.tapZone}
          onPress={mode === 'home' ? handleHomeCardPress : handleToggleAnswer}
        >
          <Animated.View
            style={[
              styles.cardZone,
              { bottom: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, difficultyReserve] }) },
            ]}
            pointerEvents="none"
          >
            {mode === 'review' && !currentCard ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Animated.View style={[styles.cardScaleWrapper, { transform: [{ scale: scaleAnimation }] }]}>
                <Animated.View
                  style={[
                    styles.card,
                    {
                      minHeight: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 250] }),
                      borderBottomWidth: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 8] }),
                      borderBottomColor: mode === 'review' ? getAnimatedBorderColor() : theme.primary,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardText, { color: mode === 'review' ? getTextColor() : theme.text }]}>
                      {mode === 'home' ? getCardTextMessage() : currentCard?.front}
                    </Text>

                    {mode === 'review' && showAnswer && <View style={styles.separator} />}

                    {mode === 'review' && showAnswer && (
                      <Animated.View style={{ opacity: fadeAnimation }}>
                        <Text style={[styles.cardText, { color: getTextColor() }]}>{currentCard?.back}</Text>
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>
        </Pressable>

        {/* Boutons de difficulté, uniquement en révision une fois la réponse révélée.
            opacity: reviewLayerOpacity (= transitionAnim) — même valeur que le titre
            "Révision globale" dans la topBar, pour fondre exactement à la même
            vitesse que lui à la sortie. Sans ça (View simple, non animée), les
            boutons restaient pleinement opaques jusqu'à la toute fin du tween de
            sortie (mode ne repasse à 'home' qu'à la fin), pendant que le FAB '+'
            fondait déjà en entrée par-dessus — d'où le chevauchement. */}
        {mode === 'review' && showAnswer && (
          <Animated.View style={[styles.difficultyContainer, { opacity: reviewLayerOpacity }]}>
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
                  <Text style={[styles.difficultyButtonText, { color: getButtonTextColor('hard') }]}>
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
                  <Text style={[styles.difficultyButtonText, { color: getButtonTextColor('medium') }]}>
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
                  <Text style={[styles.difficultyButtonText, { color: getButtonTextColor('easy') }]}>
                    Facile
                  </Text>
                </Pressable>
              </Animated.View>
            </View>

            {/* Stats de la carte : seulement une fois qu'on a répondu (pas dès que
                la réponse est révélée), affichées sous les boutons comme avant. */}
            {selectedDifficulty && currentCard && (
              <View style={styles.cardStatsContainer}>
                <Text style={styles.cardStatsText}>
                  Win Streak: {currentCard.repetitions || 0} •
                  Lapses: {currentCard.lapses || 0} •
                  Facilité: {difficultyToEasePercent(currentCard.difficulty) ?? '—'}% •
                  Statut: {getCardMastery(currentCard.stability, currentCard.difficulty, currentCard.lapses || 0)}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Bouton flottant d'ajout rapide — masqué pendant la révision. L'opacité
            animée doit être portée par la vue positionnée en absolute elle-même
            (styles.fab), pas par un wrapper neutre : sinon ce wrapper (seul enfant
            en flux normal de mainContent, tout le reste étant en absolute) se fait
            placer en haut par le flex du parent, et le bouton se retrouve collé au
            top au lieu de bas-droite. */}
        <Animated.View
          style={[styles.fab, { opacity: homeLayerOpacity }]}
          pointerEvents={mode === 'home' ? 'auto' : 'none'}
        >
          <Pressable
            style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
            onPress={openQuickAdd}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Modal d'ajout rapide */}
      <AddCardModal
        visible={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onCardAdded={async () => {
          await updateHomeScreenCard(); // Attendez que la mise à jour soit finie
          await fetchTotalCardsCount();
          setShowQuickAddModal(false);
        }}
      />

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
            { opacity: modalBackgroundAnimation },
          ]}
        >
          <Animated.View
            style={[
              styles.endSessionModal,
              { transform: [{ scale: modalScaleAnimation }] },
            ]}
          >
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

            <Text style={styles.endSessionTitle}>Félicitations !</Text>
            <Text style={styles.endSessionSubtitle}>Session terminée</Text>
            <Text style={styles.endSessionMessage}>
              Vous avez révisé {totalCardsReviewed} cartes aujourd'hui. Excellent travail !
            </Text>

            <Pressable style={styles.endSessionButton} onPress={handleEndSession}>
              <Text style={staticStyles.endSessionButtonText}>Retour à l'accueil</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
