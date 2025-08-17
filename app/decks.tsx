// app/decks.tsx
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Deck } from '../types/database';
import AddDeckModal from '../components/AddDeckModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function Decks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDecks();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      fetchDecks();
    }
  }, [user]);

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
        Alert.alert('Erreur', 'Impossible de charger les decks');
      } else {
        setDecks(data || []);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeckAdded = () => {
    fetchDecks(); // Recharger la liste des decks
    setShowAddModal(false);
  };

  const renderDeck = ({ item }: { item: Deck }) => (
    <Pressable 
      style={[
        styles.deckCard,
        { borderLeftColor: item.color || '#007AFF' }
      ]}
      onPress={() => router.push(`/deck/${item.id}`)}
    >
      <View style={styles.deckHeader}>
        <Text 
          style={styles.deckName}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {item.name}
        </Text>
      </View>
      {item.description && (
        <Text style={styles.deckDescription}>{item.description}</Text>
      )}
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header avec bouton retour intégré */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </Pressable>
            <View style={styles.titleContainer}>
              <Text style={styles.mainTitle}>Mes Collections</Text>
              <View style={styles.titleUnderline} />
            </View>
            <Pressable 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {decks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Aucune collection trouvée</Text>
            <Text style={styles.emptySubtext}>
              Créez-en une pour commencer !
            </Text>
          </View>
        ) : (
          <FlatList
            data={decks}
            renderItem={renderDeck}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Modal d'ajout de deck */}
      <AddDeckModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onDeckAdded={handleDeckAdded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 12,
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
  loadingText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#666',
    marginTop: 50,
  },
  listContainer: {
    padding: 20,
  },
  deckCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Retour à 'center' pour centrer la flèche
    marginBottom: 8,
    minHeight: 24, // Hauteur minimum pour éviter que la flèche sorte
  },
  deckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12, // Un peu plus d'espace
    lineHeight: 24, // Hauteur de ligne cohérente
  },
  deckDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  deckDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});