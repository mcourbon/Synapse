import { View, Text, StyleSheet, Pressable, Alert, Animated, Modal, ActivityIndicator, Easing, BackHandler, useWindowDimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/logger';
import { Card } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import AddCardModal from '../components/AddCardModal';
import { useTheme } from '../contexts/ThemeContext';
import { useStats } from '../contexts/StatsContext';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { scheduleNext, isDue, getCardMastery, difficultyToEasePercent, ReviewResponse } from '../utils/fsrs';
import { StatsTracker } from '../lib/statsTracker';
import { isFiche, ficheSteps, cardTitle } from '../utils/fiche';
import StreakFlame from '../components/StreakFlame';
import ProfessionalProgressCircle from '../components/ProfessionalProgressCircle';
import AnimatedSuccessIcon from '../components/AnimatedSuccessIcon';
import SwipeableCard, { useCardSwipe, SwipeDirection } from '../components/SwipeableCard';
import AnswerButtons from '../components/AnswerButtons';

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
  // Fiches (cartes sans verso) : nombre de lignes déjà dévoilées, la 1re (titre) d'office.
  const [revealedSteps, setRevealedSteps] = useState(1);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [totalCardsReviewed, setTotalCardsReviewed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cardStartTime, setCardStartTime] = useState<Date>(new Date());
  const answeringRef = useRef(false);
  const ficheScrollRef = useRef<ScrollView>(null);
  // Les écritures (carte + user_stats) partent en arrière-plan pour enchaîner les
  // cartes sans attendre le réseau, mais restent sérialisées : StatsTracker fait un
  // lire-modifier-écrire sur user_stats, deux réponses en parallèle perdraient des
  // compteurs. Tout ce qui relit les données (stats, tinycard) attend cette file.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveErrorShownRef = useRef(false);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
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

  // Hauteur max de la carte, même logique bornée (min/max dérivés de l'écran) que
  // topOffset/difficultyReserve ci-dessus — au-delà, le texte recto/verso défile en
  // interne (ScrollView) plutôt que de pousser la carte plus haut que l'espace
  // disponible (ce qui la faisait déborder par-dessus le header ou les boutons de
  // difficulté sur les cartes à texte long, ~300 caractères).
  const cardMaxHeight = Math.round(Math.min(420, Math.max(280, screenHeight * 0.45)));
  const cardContentPadding = 24 * 2; // cardContent.padding, haut + bas
  const cardSeparatorSpace = 2 + 20 * 2; // separator.height + marginVertical haut/bas
  const cardTextMaxHeightFull = cardMaxHeight - cardContentPadding;
  const cardTextMaxHeightSplit = Math.round((cardMaxHeight - cardContentPadding - cardSeparatorSpace) / 2);
  const ficheHintSpace = 12 + 18; // ficheHint.marginTop + une ligne de texte

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
      maxHeight: cardMaxHeight,
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
    // Bornent la hauteur du texte recto/verso : tant que ça tient, ScrollView se
    // comporte comme un simple conteneur (contentContainerStyle centre le texte
    // verticalement comme avant) ; au-delà, ça défile au lieu de déborder de la
    // carte. "Full" = recto seul (réponse pas encore révélée), "Split" = recto et
    // verso une fois la réponse révélée, chacun sa moitié du budget vertical.
    textScrollFull: {
      alignSelf: 'stretch',
      maxHeight: cardTextMaxHeightFull,
    },
    textScrollSplit: {
      alignSelf: 'stretch',
      maxHeight: cardTextMaxHeightSplit,
    },
    textScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    // Fiche : place gardée sous les lignes pour l'indication "Touchez pour la suite".
    textScrollFiche: {
      alignSelf: 'stretch',
      maxHeight: cardTextMaxHeightFull - ficheHintSpace,
    },
    ficheLine: {
      fontSize: 17,
      lineHeight: 24,
      color: theme.text,
      textAlign: 'center',
      marginTop: 14,
    },
    ficheHint: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 12,
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
        logError('Home.fetchTotalCardsCount', error);
        return;
      }

      setTotalCardsCount(count || 0);
    } catch (error) {
      logError('Home.fetchTotalCardsCount', error);
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
      return cardTitle(homeCard); // pour une fiche : sa 1re ligne, comme au début de la révision
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
    setRevealedSteps(1);
    setTotalCardsReviewed(0);
    setStreak(0);
    setCardStartTime(new Date());
    saveErrorShownRef.current = false;
    fadeAnimation.setValue(0);
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
      setRevealedSteps(1);
      scaleAnimation.setValue(1);
      // Attendre les dernières réponses encore en cours d'écriture, sinon la
      // tinycard pourrait reproposer une carte qu'on vient juste de réviser.
      writeQueueRef.current.then(() => {
        updateHomeScreenCard();
        fetchTotalCardsCount();
      });
    });
  };

  const handleToggleAnswer = () => {
    if (mode !== 'review' || showAnswer || !currentCard) return;

    // Fiche : chaque tap dévoile la ligne suivante, jusqu'à la dernière.
    if (isFiche(currentCard)) {
      setRevealedSteps(prev => Math.min(prev + 1, ficheSteps(currentCard.front).length));
      return;
    }

    // Quand on révèle la réponse, on démarre le timer
    setCardStartTime(new Date());
    setShowAnswer(true);
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // queueLength : longueur de la file APRÈS la réponse (une carte "à revoir" y est
  // rajoutée à la fin), le state dueCards n'étant pas encore à jour à ce moment-là.
  const goToNextCard = (queueLength: number) => {
    setCardStartTime(new Date()); // ⭐ RESET LE TIMER
    const nextIndex = currentCardIndex + 1;

    if (nextIndex >= queueLength) {
      // Session terminée - rafraîchir les stats une fois toutes les réponses écrites
      writeQueueRef.current.then(() => refreshStats());
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
    setRevealedSteps(1);
    fadeAnimation.setValue(0);

    // Animation d'entrée
    scaleAnimation.setValue(0.8);
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  // Écrit une réponse en base, en file derrière les précédentes (voir writeQueueRef).
  const persistReview = (card: Card, update: Partial<Card>, response: ReviewResponse, studyTime: number) => {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      try {
        const { error } = await supabase.from('cards').update(update).eq('id', card.id);
        if (error) throw error;

        await StatsTracker.trackReview({
          userId: user!.id,
          response,
          cardId: card.id,
          deckId: card.deck_id,
          studyTime,
        });
      } catch (error) {
        logError('Home.persistReview', error);
        // Une seule alerte par session, pas une par carte si le réseau est coupé
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          Alert.alert('Erreur', "Une révision n'a pas pu être enregistrée. Vérifiez votre connexion.");
        }
      }
    });
  };

  // Appelée une fois la carte sortie de l'écran (swipe ou bouton).
  // Droite = "je savais" -> Good (3) ; gauche = "à revoir" -> Again (1), la carte
  // revient en fin de session (comme avant, où elle restait affichée jusqu'à réussite).
  const handleAnswer = (direction: SwipeDirection) => {
    const card = dueCards[currentCardIndex];
    if (answeringRef.current || !card) return;
    answeringRef.current = true;

    const response: ReviewResponse = direction === 'right' ? 'medium' : 'hard';
    const knewIt = response !== 'hard';

    // Streak de réussites d'affilée : "je savais" l'incrémente, "à revoir" la remet à zéro
    setStreak(prev => (knewIt ? prev + 1 : 0));

    const result = scheduleNext(
      {
        stability: card.stability ?? null,
        difficulty: card.difficulty ?? null,
        lastReviewed: card.last_reviewed,
        lapses: card.lapses || 0,
      },
      response
    );

    const update = {
      stability: result.stability,
      difficulty: result.difficulty,
      interval: result.interval,
      repetitions: knewIt ? (card.repetitions || 0) + 1 : 0,
      last_reviewed: result.lastReviewed.toISOString(),
      next_review: result.nextReview.toISOString(),
      lapses: result.lapses,
    };
    const updatedCard = { ...card, ...update };

    const queue = dueCards.map((c, index) => (index === currentCardIndex ? updatedCard : c));
    if (!knewIt) queue.push(updatedCard);
    setDueCards(queue);
    setTotalCardsReviewed(prev => prev + 1);

    const studyTime = Math.floor((new Date().getTime() - cardStartTime.getTime()) / 1000);
    persistReview(card, update, response, studyTime);

    goToNextCard(queue.length);
    answeringRef.current = false;
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

  const currentCard = dueCards[currentCardIndex];
  const isReviewReady = mode === 'review' && !!currentCard;
  const currentIsFiche = isReviewReady && isFiche(currentCard);
  const currentFicheSteps = currentIsFiche ? ficheSteps(currentCard.front) : [];
  // Prêt à répondre : verso révélé, ou toutes les lignes de la fiche dévoilées.
  const answerReady = isReviewReady && (currentIsFiche ? revealedSteps >= currentFicheSteps.length : showAnswer);
  const cardSwipe = useCardSwipe({
    enabled: answerReady,
    resetKey: `${mode}-${currentCardIndex}`,
    onSwipe: handleAnswer,
  });
  const textTint = cardSwipe.tint(theme.text);

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
          <Animated.View
            style={[styles.headerCenter, { opacity: reviewLayerOpacity }]}
            pointerEvents="none"
            needsOffscreenAlphaCompositing
          >
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
          <Animated.View
            style={{ opacity: homeLayerOpacity }}
            pointerEvents="none"
            needsOffscreenAlphaCompositing
          >
            <Text style={styles.welcomeText}>{getWelcomeMessage()}</Text>
          </Animated.View>
        </View>

        {/* Zone cliquable : n'importe où sous le bandeau du haut (pas seulement la
            carte) retourne la carte à l'accueil, ou révèle la réponse en révision.
            La carte elle-même n'a plus son propre Pressable — purement visuelle,
            pointerEvents 'none' pour laisser passer le tap jusqu'ici.
            Le swipe de la carte est capté par la View qui l'englobe (ancêtre du
            Pressable), voir l'en-tête de components/SwipeableCard.tsx. */}
        <View style={styles.tapZone} {...cardSwipe.panHandlers}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={mode === 'home' ? handleHomeCardPress : handleToggleAnswer}
        >
          <Animated.View
            style={[
              styles.cardZone,
              { bottom: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, difficultyReserve] }) },
            ]}
            // box-none (au lieu de none) : la zone elle-même laisse toujours passer le
            // tap vers tapZone en dessous (flip/révéler la réponse), mais ses enfants
            // — les ScrollView du recto/verso — doivent rester de vraies cibles tactiles
            // pour pouvoir défiler. 'none' bloquait tout le sous-arbre, y compris eux.
            pointerEvents="box-none"
          >
            {mode === 'review' && !currentCard ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Animated.View style={[styles.cardScaleWrapper, { transform: [{ scale: scaleAnimation }] }]}>
                {/* Swipe droite/gauche une fois la réponse affichée — nœud animé à part,
                    voir l'en-tête de components/SwipeableCard.tsx. */}
                <SwipeableCard swipe={cardSwipe}>
                <Animated.View
                  style={[
                    styles.card,
                    {
                      minHeight: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 250] }),
                      borderBottomWidth: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 8] }),
                      // Vire au vert / rouge pendant le glissé (voir useCardSwipe)
                      borderBottomColor: cardSwipe.tint(theme.primary),
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    {currentIsFiche ? (
                      <>
                        {/* Fiche : lignes dévoilées une à une, défile vers la dernière
                            dévoilée quand ça dépasse la hauteur de la carte. */}
                        <ScrollView
                          ref={ficheScrollRef}
                          style={styles.textScrollFiche}
                          contentContainerStyle={styles.textScrollContent}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                          overScrollMode="never"
                          onContentSizeChange={() => ficheScrollRef.current?.scrollToEnd({ animated: true })}
                        >
                          {currentFicheSteps.slice(0, revealedSteps).map((line, index) => (
                            <Animated.Text key={index} selectable={false} style={[index === 0 ? styles.cardText : styles.ficheLine, { color: textTint }]}>
                              {line}
                            </Animated.Text>
                          ))}
                        </ScrollView>
                        <Text style={styles.ficheHint}>
                          {answerReady
                            ? 'Fiche terminée'
                            : `Touchez pour la suite · ${revealedSteps}/${currentFicheSteps.length}`}
                        </Text>
                      </>
                    ) : (
                      <>
                        {/* Recto : défile en interne plutôt que de déborder de la carte sur
                            les textes longs (voir cardMaxHeight plus haut). */}
                        <ScrollView
                          style={mode === 'review' && showAnswer ? styles.textScrollSplit : styles.textScrollFull}
                          contentContainerStyle={styles.textScrollContent}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                          overScrollMode="never"
                        >
                          <Animated.Text selectable={false} style={[styles.cardText, { color: textTint }]}>
                            {mode === 'home' ? getCardTextMessage() : currentCard?.front}
                          </Animated.Text>
                        </ScrollView>

                        {mode === 'review' && showAnswer && <View style={styles.separator} />}

                        {mode === 'review' && showAnswer && (
                          <Animated.View style={{ opacity: fadeAnimation }}>
                            <ScrollView
                              style={styles.textScrollSplit}
                              contentContainerStyle={styles.textScrollContent}
                              showsVerticalScrollIndicator={false}
                              bounces={false}
                              overScrollMode="never"
                            >
                              <Animated.Text selectable={false} style={[styles.cardText, { color: textTint }]}>{currentCard?.back}</Animated.Text>
                            </ScrollView>
                          </Animated.View>
                        )}
                      </>
                    )}
                  </View>
                </Animated.View>
                </SwipeableCard>
              </Animated.View>
            )}
          </Animated.View>
        </Pressable>
        </View>

        {/* Réponses ("À revoir" / "Je savais"), uniquement en révision une fois la
            réponse révélée — ou la fiche entièrement dévoilée.
            opacity: reviewLayerOpacity (= transitionAnim) — même valeur que le titre
            "Révision globale" dans la topBar, pour fondre exactement à la même
            vitesse que lui à la sortie. Sans ça (View simple, non animée), les
            boutons restaient pleinement opaques jusqu'à la toute fin du tween de
            sortie (mode ne repasse à 'home' qu'à la fin), pendant que le FAB '+'
            fondait déjà en entrée par-dessus — d'où le chevauchement. */}
        {answerReady && (
          <Animated.View style={[styles.difficultyContainer, { opacity: reviewLayerOpacity }]}>
            <AnswerButtons onAnswer={cardSwipe.swipe} />

            {currentCard && (
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
