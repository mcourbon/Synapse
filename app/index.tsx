import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Card } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import AddCardModal from '../components/AddCardModal';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { isDue } from '../utils/fsrs';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [totalCardsCount, setTotalCardsCount] = useState<number>(0);
  const { theme } = useTheme();

  // Dans le composant, après const { theme } = useTheme();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
      width: '100%',
      maxWidth: 500,
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
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${theme.surface}dd`,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
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
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingVertical: 0,
      paddingHorizontal: 0,
      width: '90%',
      maxWidth: 400,
      aspectRatio: 5 / 3,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
      marginBottom: 28,
      overflow: 'hidden',
      zIndex: 2,
      position: 'relative',
      borderBottomWidth: 12,
      borderBottomColor: theme.primary,
    },
    tinycardText: {
      color: theme.text,
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      letterSpacing: 0.3,
      lineHeight: 32,
      zIndex: 2,
      paddingHorizontal: 32,
    },
    welcomeOverlay: {
      position: 'absolute',
      top: 100,
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
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

  async function updateHomeScreenCard() {
    if (!user) return;

    try {
      // On réutilise la fonction qui cherche les cartes dues
      const dueCards = await fetchAllDueCards();

      if (dueCards && dueCards.length > 0) {
        // S'il y a des cartes à réviser, on en choisit une au hasard
        const randomIndex = Math.floor(Math.random() * dueCards.length);
        setCard(dueCards[randomIndex]);
      } else {
        // S'il n'y a AUCUNE carte à réviser, on met l'état à null
        setCard(null);
      }
    } catch (err) {
      setCard(null); // En cas d'erreur, on n'affiche rien non plus
    }
  }

  // Nouvelle fonction pour récupérer toutes les cartes dues
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
    if (card) {
      return card.front;
    }
    // Cas 2: Il n'y a pas de carte à réviser, mais l'utilisateur a déjà créé des cartes
    if (totalCardsCount > 0) {
      return "Toutes vos cartes sont à jour !";
    }
    // Cas 3: L'utilisateur n'a encore jamais créé de carte
    return "Commencez par créer votre premier deck !";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Flashcard en fond façon Tinycards */}
        <View style={styles.tinycardWrapper}>
          <Pressable
            style={styles.tinycard}
            onPress={async () => {
              const dueCards = await fetchAllDueCards();
              if (dueCards.length === 0) {
                Alert.alert('Aucune carte due', 'Toutes vos cartes sont à jour ! Revenez plus tard.');
                return;
              }
              // On envoie l'id de la carte affichée ici pour qu'elle soit la première
              // de la session de révision, plutôt qu'un autre tirage aléatoire côté review/global.
              router.push({ pathname: '/review/global', params: { firstCardId: card?.id ?? '' } });
            }}
          >
            <Text style={styles.tinycardText}>
              {getCardTextMessage()}
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
            <Ionicons name="albums" size={28} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/profile')}>
            <Ionicons name="person" size={28} color={theme.primary} />
          </Pressable>
        </View>

        {/* Bouton flottant d'ajout rapide */}
        <Pressable style={styles.fab} onPress={openQuickAdd}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
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
    </SafeAreaView>
  );
}
