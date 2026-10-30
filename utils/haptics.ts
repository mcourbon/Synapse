// utils/haptics.ts
// Retours haptiques du swipe, via expo-haptics (module natif : nécessite un build
// qui l'inclut, une mise à jour OTA seule ne suffit pas). On utilise les effets
// système, comme les apps modernes : sur Android, les retours de l'OS (ceux des
// boutons / du clavier, réglés pour le moteur du téléphone) ; sur iOS, le Taptic
// Engine. L'ancienne version passait par Vibration.vibrate(ms) de React Native et
// ne se sentait pas sur Android. Rien sur web.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Tic léger : la carte passe le seuil de validation pendant le glissé. */
export function hapticTick() {
  if (Platform.OS === 'android') {
    // Clock_Tick : disponible sur tous les Android (Segment_Tick demande Android 14).
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick).catch(() => {});
  } else if (Platform.OS === 'ios') {
    Haptics.selectionAsync().catch(() => {});
  }
}

/** Un peu plus marqué : la réponse est validée. */
export function hapticConfirm() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => {});
  } else if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}
