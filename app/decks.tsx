// app/decks.tsx
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Deck } from '../types/database';
import AddDeckModal from '../components/AddDeckModal';
import { useAuth } from '../contexts/AuthContext';

export default function Decks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

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
      style={styles.deckCard}
      onPress={() => router.push(`/deck/${item.id}`)}
    >
      <View style={styles.deckHeader}>
        <Text style={styles.deckName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      {item.description && (
        <Text style={styles.deckDescription}>{item.description}</Text>
      )}
      <Text style={styles.deckDate}>
        Créé le {new Date(item.created_at).toLocaleDateString('fr-FR')}
      </Text>
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
      {/* Header amélioré avec bouton retour */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.title}>Mes Collections 🧠</Text>
        <Pressable 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {decks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Aucun deck trouvé</Text>
          <Text style={styles.emptySubtext}>
            Créez votre premier deck pour commencer !
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  deckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
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