// components/SwipeableCard.tsx
// Carte de révision qu'on glisse à droite ("je savais") ou à gauche ("à revoir").
//
// Glisser-déposer contrôlé : la carte suit le doigt tant qu'il est posé, et sa couleur
// (bordure du bas + texte, via tint()) vire progressivement au vert ou au rouge. La
// couleur est pleine pile au seuil de validation : relâcher au-delà valide, en deçà la
// carte revient au centre — on peut donc s'arrêter ou revenir en plein geste.
// Un geste vif ("lancer") valide aussi sur une courte distance, comme sur les apps de
// swipe, et un lancer franc dans l'autre sens annule même au-delà du seuil : voir
// swipeDecision(). Un glissé lent relâché avant le seuil revient toujours au centre.
// Vibrations (Android) : un tic au passage du seuil, un plus marqué à la validation
// (utils/haptics.ts).
//
// Le geste et le visuel sont séparés :
// - useCardSwipe() fournit les panHandlers, à poser sur une vue qui ENGLOBE la zone
//   tappable (le Pressable qui révèle la réponse), pas sur la carte elle-même. Le
//   Pressable devient le responder dès le toucher ; ensuite, le système de responders
//   de React Native (natif comme web) ne laisse que ses ANCÊTRES le lui reprendre sur
//   un mouvement — une carte posée à l'intérieur n'est jamais consultée, le swipe ne
//   partait donc jamais quand les handlers étaient sur la carte.
// - <SwipeableCard swipe={...}> déplace/incline la carte.
//
// Le geste ne s'active que si `enabled` (réponse affichée) et seulement sur un
// mouvement nettement horizontal : un tap reste un tap (révéler la réponse / la ligne
// suivante d'une fiche) et un glissement vertical reste un scroll des textes longs.
// Les boutons de l'écran déclenchent la même sortie via swipe.swipe(direction).
//
// translateX tourne en JS driver (useNativeDriver: false) pour pouvoir piloter des
// couleurs, ce que le native driver ne sait pas faire. Il ne doit donc jamais animer
// un nœud qui porte aussi une animation native : SwipeableCard a son propre
// Animated.View, distinct du nœud du scale (cardScaleWrapper, native driver) —
// mélanger les deux drivers sur un même nœud plante Android/Hermes (voir le
// commentaire sur cardScaleWrapper dans app/deck/[id].tsx).
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, GestureResponderHandlers, PanResponder, useWindowDimensions } from 'react-native';
import { hapticConfirm, hapticTick } from '../utils/haptics';

export type SwipeDirection = 'left' | 'right';

export const SWIPE_KNEW_COLOR = '#34C759';
export const SWIPE_AGAIN_COLOR = '#FF3B30';

export interface CardSwipe {
  panHandlers: GestureResponderHandlers;
  swipe: (direction: SwipeDirection) => void;
  /** Couleur `base` au repos, qui vire au vert (droite) ou au rouge (gauche) avec le glissé. */
  tint: (base: string) => Animated.AnimatedInterpolation<string>;
  translateX: Animated.Value;
  width: number;
}

interface UseCardSwipeOptions {
  enabled: boolean;
  /** Change à chaque nouvelle carte affichée : recentre la carte sortie de l'écran. */
  resetKey: string;
  onSwipe: (direction: SwipeDirection) => void;
}

// Distance à dépasser pour valider : 35% de la largeur d'écran (~140px sur un tel),
// plafonnée pour ne pas exiger un geste démesuré sur tablette / web.
const SWIPE_THRESHOLD_RATIO = 0.35;
const SWIPE_THRESHOLD_MAX = 160;
const swipeThreshold = (width: number) => Math.min(width * SWIPE_THRESHOLD_RATIO, SWIPE_THRESHOLD_MAX);
const FLY_OUT_DURATION = 220;
// Lancer : vitesse au relâché (px/ms, ~500px/s) et distance minimale pour valider
// sans atteindre le seuil — la distance évite qu'un simple tremblement parte.
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_DISTANCE = 25;

/** Décision au relâché : direction validée, ou null pour revenir au centre. */
export function swipeDecision(dx: number, vx: number, threshold: number): SwipeDirection | null {
  if (dx >= threshold) return vx < -FLICK_VELOCITY ? null : 'right';
  if (dx <= -threshold) return vx > FLICK_VELOCITY ? null : 'left';
  if (vx > FLICK_VELOCITY && dx > FLICK_MIN_DISTANCE) return 'right';
  if (vx < -FLICK_VELOCITY && dx < -FLICK_MIN_DISTANCE) return 'left';
  return null;
}

export function useCardSwipe({ enabled, resetKey, onSwipe }: UseCardSwipeOptions): CardSwipe {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const flyingRef = useRef(false);
  // PanResponder remet dx à zéro au moment où il prend la main, soit après les ~12px
  // nécessaires pour reconnaître un geste horizontal : on les rajoute pour que la
  // carte colle au doigt au lieu de traîner derrière.
  const slopRef = useRef(0);
  const pastThresholdRef = useRef(false);

  // Le PanResponder est créé une seule fois : il lit les dernières valeurs via ces refs.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    flyingRef.current = false;
  }, [resetKey, translateX]);

  // from/velocity : position et vitesse au relâché d'un geste, pour que la carte
  // parte dans la continuité du lancer (plus vif = plus rapide) au lieu de repartir
  // à vitesse fixe. Boutons / clavier : partie du centre à vitesse standard.
  const flyOut = (direction: SwipeDirection, from = 0, velocity = 0) => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    hapticConfirm();
    const toValue = (direction === 'right' ? 1 : -1) * widthRef.current * 1.5;
    const speed = Math.abs(velocity);
    const duration = speed > FLICK_VELOCITY
      ? Math.min(FLY_OUT_DURATION, Math.max(120, Math.abs(toValue - from) / speed))
      : FLY_OUT_DURATION;
    Animated.timing(translateX, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start(() => onSwipeRef.current(direction));
  };

  const springBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 7,
      tension: 70,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Phase "capture" : consultée de la racine vers le Pressable qui tient le
        // toucher, donc avant lui — on ne prend la main que sur un mouvement
        // franchement horizontal, le reste (tap, scroll vertical) lui est laissé.
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const take =
            enabledRef.current &&
            !flyingRef.current &&
            Math.abs(g.dx) > 12 &&
            Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
          if (take) slopRef.current = g.dx;
          return take;
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation(); // reprendre la carte en plein retour au centre
          pastThresholdRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const dx = g.dx + slopRef.current;
          translateX.setValue(dx);
          // Tic à chaque passage du seuil vers l'extérieur (pas au retour)
          const past = Math.abs(dx) >= swipeThreshold(widthRef.current);
          if (past && !pastThresholdRef.current) hapticTick();
          pastThresholdRef.current = past;
        },
        onPanResponderRelease: (_, g) => {
          const threshold = swipeThreshold(widthRef.current);
          const dx = g.dx + slopRef.current;
          const direction = swipeDecision(dx, g.vx, threshold);
          if (direction) {
            flyOut(direction, dx, g.vx);
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: springBack,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const threshold = swipeThreshold(width);

  return {
    panHandlers: panResponder.panHandlers,
    swipe: (direction: SwipeDirection) => {
      if (enabledRef.current) flyOut(direction);
    },
    tint: (base: string) =>
      translateX.interpolate({
        inputRange: [-threshold, 0, threshold],
        outputRange: [SWIPE_AGAIN_COLOR, base, SWIPE_KNEW_COLOR],
        extrapolate: 'clamp',
      }),
    translateX,
    width,
  };
}

interface SwipeableCardProps {
  swipe: CardSwipe;
  children: React.ReactNode;
}

export default function SwipeableCard({ swipe, children }: SwipeableCardProps) {
  const { translateX, width } = swipe;

  const rotate = translateX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <Animated.View style={{ transform: [{ translateX }, { rotate }] }}>
      {children}
    </Animated.View>
  );
}
