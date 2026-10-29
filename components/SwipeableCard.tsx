// components/SwipeableCard.tsx
// Carte de révision qu'on glisse à droite ("je savais") ou à gauche ("à revoir").
//
// Glisser-déposer contrôlé : la carte suit le doigt tant qu'il est posé, et sa couleur
// (bordure du bas + texte, via tint()) vire progressivement au vert ou au rouge. La
// couleur est pleine pile au seuil de validation : relâcher au-delà valide, en deçà la
// carte revient au centre — on peut donc s'arrêter ou revenir en plein geste. Pas de
// validation "au vol" sur un geste vif : seule la distance compte.
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

export function useCardSwipe({ enabled, resetKey, onSwipe }: UseCardSwipeOptions): CardSwipe {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const flyingRef = useRef(false);
  // PanResponder remet dx à zéro au moment où il prend la main, soit après les ~12px
  // nécessaires pour reconnaître un geste horizontal : on les rajoute pour que la
  // carte colle au doigt au lieu de traîner derrière.
  const slopRef = useRef(0);

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

  const flyOut = (direction: SwipeDirection) => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    Animated.timing(translateX, {
      toValue: (direction === 'right' ? 1 : -1) * widthRef.current * 1.5,
      duration: FLY_OUT_DURATION,
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
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          translateX.setValue(g.dx + slopRef.current);
        },
        onPanResponderRelease: (_, g) => {
          const threshold = swipeThreshold(widthRef.current);
          const dx = g.dx + slopRef.current;
          if (dx >= threshold) {
            flyOut('right');
          } else if (dx <= -threshold) {
            flyOut('left');
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
