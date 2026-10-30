// utils/haptics.ts
// Retours vibrants du swipe, via l'API Vibration de React Native : rien à installer,
// donc ça passe par une simple mise à jour OTA (expo-haptics demanderait un nouveau
// build). Android uniquement : sur iOS, Vibration ignore la durée et vibre ~0,4s,
// bien trop fort pour un "tic" ; sur web, pas de vibration non plus.
import { Platform, Vibration } from 'react-native';

const enabled = Platform.OS === 'android';

/** Tic léger : la carte passe le seuil de validation pendant le glissé. */
export function hapticTick() {
  if (enabled) Vibration.vibrate(10);
}

/** Un peu plus marqué : la réponse est validée. */
export function hapticConfirm() {
  if (enabled) Vibration.vibrate(20);
}
