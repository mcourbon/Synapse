// app/politique-de-confidentialite.tsx
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

const CONTACT_EMAIL = 'synapse.contact.app@gmail.com';
const LAST_UPDATED = '1 août 2026';

export default function PolitiqueConfidentialite() {
  const router = useRouter();
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
      width: '100%',
      maxWidth: 700,
    },
    headerSection: {
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 60,
    },
    updatedText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 24,
    },
    h2: {
      fontSize: 19,
      fontWeight: '700',
      color: theme.text,
      marginTop: 24,
      marginBottom: 10,
    },
    p: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
      marginBottom: 8,
    },
    li: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
      marginBottom: 6,
      paddingLeft: 8,
    },
    box: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    emailLink: {
      color: theme.primary,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            >
              <Ionicons name="chevron-back" size={22} color={theme.primary} />
            </Pressable>
            <Text style={styles.title}>Politique de confidentialité</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.updatedText}>Dernière mise à jour : {LAST_UPDATED}</Text>

          <Text style={styles.p}>
            Synapse est une application de révision par cartes (flashcards) avec répétition espacée. Cette page explique
            quelles données sont collectées, pourquoi, et comment les contrôler.
          </Text>

          <Text style={styles.h2}>Données collectées</Text>
          <Text style={styles.p}>Si vous créez un compte, nous collectons :</Text>
          <Text style={styles.li}>• Votre adresse email et votre mot de passe (le mot de passe est haché, jamais stocké en clair)</Text>
          <Text style={styles.li}>• Un pseudo, optionnel, que vous choisissez</Text>
          <Text style={styles.li}>• Une photo de profil, optionnelle, si vous en ajoutez une</Text>
          <Text style={styles.li}>• Le contenu que vous créez : vos collections et vos cartes (recto/verso/catégories)</Text>
          <Text style={styles.li}>• Vos statistiques de révision (nombre de cartes révisées, séries de jours, temps d'étude) — utilisées uniquement pour vous les afficher</Text>

          <View style={styles.box}>
            <Text style={styles.p}>
              <Text style={{ fontWeight: '700' }}>Mode invité (démo) : </Text>
              si vous utilisez l'application sans créer de compte, vos données (collections, cartes, statistiques) restent
              uniquement sur votre appareil et ne sont jamais envoyées à un serveur. Elles sont effacées quand vous quittez le
              mode invité.
            </Text>
          </View>

          <Text style={styles.h2}>Ce que nous ne collectons pas</Text>
          <Text style={styles.li}>• Aucun outil d'analyse ou de mesure d'audience (pas de Google Analytics, pas de tracker publicitaire)</Text>
          <Text style={styles.li}>• Aucune donnée de localisation</Text>
          <Text style={styles.li}>• Aucune information de paiement (l'application est gratuite)</Text>

          <Text style={styles.h2}>Utilisation des données</Text>
          <Text style={styles.p}>Vos données servent exclusivement à :</Text>
          <Text style={styles.li}>• Faire fonctionner votre compte et synchroniser vos cartes entre vos appareils</Text>
          <Text style={styles.li}>• Calculer vos statistiques de révision et votre progression</Text>
          <Text style={styles.li}>• Vous répondre si vous nous contactez</Text>

          <View style={[styles.box, { borderLeftWidth: 4, borderLeftColor: theme.error }]}>
            <Text style={styles.p}>Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales ou publicitaires.</Text>
          </View>

          <Text style={styles.h2}>Hébergement et sous-traitants</Text>
          <Text style={styles.p}>
            Les comptes, cartes et statistiques sont hébergés chez{' '}
            <Text style={{ fontWeight: '600' }}>Supabase</Text> (base de données et authentification). Les photos de profil sont
            stockées sur le service de stockage de Supabase. Aucun autre prestataire n'a accès à vos données.
          </Text>

          <Text style={styles.h2}>Vos droits (RGPD)</Text>
          <Text style={styles.p}>Conformément au RGPD, vous pouvez à tout moment :</Text>
          <Text style={styles.li}>• Accéder à vos données ou en demander une copie</Text>
          <Text style={styles.li}>• Corriger vos informations (pseudo, email)</Text>
          <Text style={styles.li}>• Demander la suppression de votre compte et de toutes vos données</Text>
          <Text style={styles.li}>• Vous opposer au traitement de vos données</Text>
          <Text style={styles.p}>Pour exercer un de ces droits, contactez-nous à l'adresse ci-dessous.</Text>

          <View style={styles.box}>
            <Text style={styles.p}>
              📧{' '}
              <Text
                style={styles.emailLink}
                onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Confidentialité Synapse`)}
              >
                {CONTACT_EMAIL}
              </Text>
            </Text>
          </View>

          <Text style={styles.h2}>Conservation des données</Text>
          <Text style={styles.p}>
            Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données sont
            supprimées définitivement de nos serveurs.
          </Text>

          <Text style={styles.h2}>Sécurité</Text>
          <Text style={styles.li}>• Connexions chiffrées (HTTPS/TLS)</Text>
          <Text style={styles.li}>• Mots de passe hachés (jamais stockés en clair)</Text>
          <Text style={styles.li}>• Accès aux données restreint par des règles de sécurité au niveau de la base de données</Text>

          <Text style={styles.h2}>Réclamation</Text>
          <Text style={styles.p}>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation auprès de la CNIL
            (www.cnil.fr).
          </Text>

          <Text style={styles.h2}>Modifications</Text>
          <Text style={styles.p}>
            Cette politique peut évoluer. Les modifications seront publiées sur cette page avec une date de mise à jour
            actualisée.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
