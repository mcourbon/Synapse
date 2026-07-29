// components/ImportCsvModal.tsx
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Deck } from '../types/database';
import { pickAndReadCsvFile } from '../lib/csvFileReader';
import { parseCsvContent, ParsedCard } from '../utils/csvImport';
import { getDeckCardCount, MAX_CARDS_PER_IMPORT, MAX_CARDS_PER_DECK } from '../lib/deckLimits';
import InfoModal from './InfoModal';

interface ImportCsvModalProps {
  visible: boolean;
  onClose: () => void;
  onImported: (deckName: string, count: number) => void;
}

type Step = 'pick' | 'destination';
type Destination = 'new' | 'existing';

const staticStyles = StyleSheet.create({
  whiteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function ImportCsvModal({ visible, onClose, onImported }: ImportCsvModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [step, setStep] = useState<Step>('pick');
  const [picking, setPicking] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [cutForImportLimit, setCutForImportLimit] = useState(0);

  const [destination, setDestination] = useState<Destination>('new');
  const [newDeckName, setNewDeckName] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('pick');
      setFileName('');
      setParsedCards([]);
      setSkippedRows(0);
      setCutForImportLimit(0);
      setDestination('new');
      setNewDeckName('');
      setSelectedDeckId(null);
      setImporting(false);
      fetchDecks();
    }
  }, [visible]);

  const fetchDecks = async () => {
    if (!user) return;
    setLoadingDecks(true);
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDecks(data);
      }
    } finally {
      setLoadingDecks(false);
    }
  };

  const handlePickFile = async () => {
    setPicking(true);
    try {
      const picked = await pickAndReadCsvFile();
      if (!picked) return;

      const result = parseCsvContent(picked.content);
      if (result.cards.length === 0) {
        Alert.alert(
          'Aucune carte trouvée',
          'Le fichier doit contenir au moins une ligne avec un recto et un verso non vides.'
        );
        return;
      }

      const cut = Math.max(0, result.cards.length - MAX_CARDS_PER_IMPORT);
      const cappedCards = result.cards.slice(0, MAX_CARDS_PER_IMPORT);

      setFileName(picked.fileName);
      setParsedCards(cappedCards);
      setSkippedRows(result.skippedRows);
      setCutForImportLimit(cut);
      setNewDeckName(picked.fileName.replace(/\.csv$/i, '').slice(0, 50));
      setStep('destination');
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de lire ce fichier');
    } finally {
      setPicking(false);
    }
  };

  const handleImport = async () => {
    if (!user || parsedCards.length === 0) return;

    if (destination === 'new' && !newDeckName.trim()) {
      Alert.alert('Erreur', 'Donnez un nom à la nouvelle collection');
      return;
    }
    if (destination === 'existing' && !selectedDeckId) {
      Alert.alert('Erreur', 'Choisissez une collection');
      return;
    }

    setImporting(true);
    try {
      let deckId: string | null = selectedDeckId;
      let deckName = decks.find(d => d.id === selectedDeckId)?.name || '';

      if (destination === 'new') {
        const cleanName = newDeckName.trim().slice(0, 50);
        const { data, error } = await supabase
          .from('decks')
          .insert([{ name: cleanName, user_id: user.id }])
          .select();
        if (error) throw error;
        deckId = data?.[0]?.id ?? null;
        deckName = cleanName;
      }

      if (!deckId) throw new Error('Collection introuvable');

      const currentCount = destination === 'existing' ? await getDeckCardCount(deckId) : 0;
      const remainingCapacity = MAX_CARDS_PER_DECK - currentCount;

      if (remainingCapacity <= 0) {
        Alert.alert('Limite atteinte', `Cette collection contient déjà le maximum de ${MAX_CARDS_PER_DECK} cartes.`);
        return;
      }

      const cardsToInsert = parsedCards.slice(0, remainingCapacity);

      const rows = cardsToInsert.map(c => ({
        deck_id: deckId,
        front: c.front,
        back: c.back,
        categories: c.categories,
      }));

      const { error: insertError } = await supabase.from('cards').insert(rows);
      if (insertError) throw insertError;

      onImported(deckName, cardsToInsert.length);
      onClose();

      if (cardsToInsert.length < parsedCards.length) {
        Alert.alert(
          'Import partiel',
          `Seules ${cardsToInsert.length} cartes ont été importées : la collection est limitée à ${MAX_CARDS_PER_DECK} cartes.`
        );
      }
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || "Impossible d'importer les cartes");
    } finally {
      setImporting(false);
    }
  };

  const styles = StyleSheet.create({
    introText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    pickButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
      marginHorizontal: 24,
      marginBottom: 24,
    },
    pickButtonDisabled: {
      opacity: 0.6,
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.success}15`,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      marginHorizontal: 24,
      marginBottom: 8,
    },
    summaryText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    skippedText: {
      fontSize: 12,
      color: theme.warning,
      marginHorizontal: 24,
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 10,
      marginHorizontal: 24,
    },
    destinationRow: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 24,
      marginBottom: 16,
    },
    destinationOption: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
    },
    destinationOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    destinationOptionDisabled: {
      opacity: 0.4,
    },
    destinationOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    inputGroup: {
      marginHorizontal: 24,
      marginBottom: 20,
    },
    textInput: {
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.primary,
      borderRadius: 12,
      padding: 15,
      fontSize: 16,
      color: theme.text,
    },
    charCount: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    deckList: {
      marginHorizontal: 24,
      marginBottom: 20,
      gap: 8,
    },
    deckOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    deckOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    deckOptionText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    importButton: {
      backgroundColor: theme.success,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginHorizontal: 24,
      marginTop: 8,
    },
    importButtonDisabled: {
      opacity: 0.6,
    },
    changeFileText: {
      fontSize: 14,
      color: theme.primary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
  });

  return (
    <InfoModal visible={visible} onClose={onClose} title="Importer des cartes" icon="cloud-upload-outline" iconColor={theme.primary}>
      {step === 'pick' && (
        <>
          <Text style={styles.introText}>
            Le fichier doit avoir au moins 2 colonnes : recto et verso. Une 3e colonne optionnelle « categories » peut lister jusqu'à 3 catégories séparées par des points-virgules.
          </Text>

          <Pressable
            style={[styles.pickButton, picking && styles.pickButtonDisabled]}
            onPress={handlePickFile}
            disabled={picking}
          >
            {picking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="document-outline" size={20} color="#fff" />
                <Text style={staticStyles.whiteText}>Choisir un fichier CSV</Text>
              </>
            )}
          </Pressable>
        </>
      )}

      {step === 'destination' && (
        <>
          <View style={styles.summaryBox}>
            <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            <Text style={styles.summaryText}>
              {parsedCards.length} carte{parsedCards.length > 1 ? 's' : ''} prête{parsedCards.length > 1 ? 's' : ''} depuis « {fileName} »
            </Text>
          </View>
          {skippedRows > 0 && (
            <Text style={styles.skippedText}>
              {skippedRows} ligne{skippedRows > 1 ? 's' : ''} ignorée{skippedRows > 1 ? 's' : ''} (recto ou verso manquant)
            </Text>
          )}
          {cutForImportLimit > 0 && (
            <Text style={styles.skippedText}>
              {cutForImportLimit} carte{cutForImportLimit > 1 ? 's' : ''} en plus ignorée{cutForImportLimit > 1 ? 's' : ''} (limite de {MAX_CARDS_PER_IMPORT} cartes par import)
            </Text>
          )}

          <Text style={styles.label}>Destination</Text>
          <View style={styles.destinationRow}>
            <Pressable
              style={[styles.destinationOption, destination === 'new' && styles.destinationOptionActive]}
              onPress={() => setDestination('new')}
            >
              <Text style={[styles.destinationOptionText, destination === 'new' && staticStyles.whiteText]}>
                Nouvelle collection
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.destinationOption,
                destination === 'existing' && styles.destinationOptionActive,
                decks.length === 0 && styles.destinationOptionDisabled,
              ]}
              onPress={() => decks.length > 0 && setDestination('existing')}
              disabled={decks.length === 0}
            >
              <Text style={[styles.destinationOptionText, destination === 'existing' && staticStyles.whiteText]}>
                Collection existante
              </Text>
            </Pressable>
          </View>

          {destination === 'new' ? (
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.textInput, { outlineWidth: 0 }]}
                value={newDeckName}
                onChangeText={setNewDeckName}
                placeholder="Nom de la collection"
                maxLength={50}
                selectionColor="#007AFF"
                underlineColorAndroid="transparent"
              />
              <Text style={styles.charCount}>{newDeckName.length}/50</Text>
            </View>
          ) : (
            <View style={styles.deckList}>
              {loadingDecks ? (
                <ActivityIndicator color={theme.primary} />
              ) : decks.length === 0 ? (
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                  Aucune collection existante — crée-en une nouvelle.
                </Text>
              ) : (
                decks.map(deck => (
                  <Pressable
                    key={deck.id}
                    style={[styles.deckOption, selectedDeckId === deck.id && styles.deckOptionActive]}
                    onPress={() => setSelectedDeckId(deck.id)}
                  >
                    <Text style={[styles.deckOptionText, selectedDeckId === deck.id && staticStyles.whiteText]}>
                      {deck.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          <Pressable
            style={[styles.importButton, importing && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={staticStyles.whiteText}>
                Importer {parsedCards.length} carte{parsedCards.length > 1 ? 's' : ''}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={handlePickFile} disabled={importing || picking}>
            <Text style={styles.changeFileText}>
              {picking ? 'Ouverture du sélecteur…' : 'Choisir un autre fichier'}
            </Text>
          </Pressable>
        </>
      )}
    </InfoModal>
  );
}
