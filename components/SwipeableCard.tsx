// components/SwipeableCard.tsx
// Carte de révision qu'on swipe à droite ("je savais") ou à gauche ("à revoir").
//
// Le geste et le visuel sont séparés :
// - useCardSwipe() fournit les panHandlers, à poser sur une vue qui ENGLOBE la zone
//   tappable (le Pressable qui révèle la réponse), pas sur la carte elle-même. Le
//   Pressable devient le responder dès le toucher ; ensuite, le système de responders
//   de React Native (natif comme web) ne laisse que ses ANCÊTRES le lui reprendre sur
//   un mouvement — une carte posée à l'intérieur n'est jamais consultée, le swipe ne
//   partait donc jamais quand les handlers étaient sur la carte.
// - <SwipeableCard swipe={...}> anime la carte (translateX/rotate) et ses tampons.
//
// Le geste ne s'active que si `enabled` (réponse affichée) et seulement sur un
// mouvement nettement horizontal : un tap reste un tap (révéler la réponse / la ligne
// suivante d'une fiche) et un glissement vertical reste un scroll des textes longs.
// Les boutons de l'écran déclenchent la même sortie via swipe.swipe(direction).
//
// SwipeableCard porte son propre Animated.View (native driver) : ne jamais le fusionner
// avec le nœud du scale (cardScaleWrapper) ni avec un nœud animé en JS driver —
// mélanger les deux drivers sur un même nœud plante Android/Hermes (voir le
// commentaire sur cardScaleWrapper dans app/deck/[id].tsx).
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, GestureResponderHandlers, PanResponder, StyleSheet, Text, useWindowDimensions } from 'react-native';

export type SwipeDirection = 'left' | 'right';

export interface CardSwipe {
  panHandlers: GestureResponderHandlers;
  swipe: (direction: SwipeDirection) => void;
  translateX: Animated.Value;
  width: number;
}

interface UseCardSwipeOptions {
  enabled: boolean;
  /** Change à chaque nouvelle carte affichée : recentre la carte sortie de l'écran. */
  resetKey: string;
  onSwipe: (direction: SwipeDirection) => void;
}

// Distance à dépasser pour valider : 25% de la largeur d'écran (~100px sur un tel),
// plafonnée pour ne pas exiger un geste démesuré sur tablette / web.
const SWIPE_THRESHOLD_RATIO = 0.25;
const SWIPE_THRESHOLD_MAX = 120;
const swipeThreshold = (width: number) => Math.min(width * SWIPE_THRESHOLD_RATIO, SWIPE_THRESHOLD_MAX);
const SWIPE_VELOCITY = 0.6; // ou un geste vif, même court
const FLY_OUT_DURATION = 220;

export function useCardSwipe({ enabled, resetKey, onSwipe }: UseCardSwipeOptions): CardSwipe {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const flyingRef = useRef(false);

  // Le PanResponder est créé une seule fois : il lit les dernières valeurs via ces refs.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    translateX.setValue(0);
    flyingRef.current = false;
  }, [resetKey, translateX]);

  const flyOut = (direction: SwipeDirection) => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    Animated.timing(translateX, {
      toValue: (direction === 'right' ? 1 : -1) * widthRef.current * 1.5,
      duration: FLY_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => onSwipeRef.current(direction));
  };

  const springBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Phase "capture" : consultée de la racine vers le Pressable qui tient le
        // toucher, donc avant lui — on ne prend la main que sur un mouvement
        // franchement horizontal, le reste (tap, scroll vertical) lui est laissé.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          enabledRef.current &&
          !flyingRef.current &&
          Math.abs(g.dx) > 12 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          translateX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          const threshold = swipeThreshold(widthRef.current);
          if (g.dx > threshold || (g.vx > SWIPE_VELOCITY && g.dx > 0)) {
            flyOut('right');
          } else if (g.dx < -threshold || (g.vx < -SWIPE_VELOCITY && g.dx < 0)) {
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

  return {
    panHandlers: panResponder.panHandlers,
    swipe: (direction: SwipeDirection) => {
      if (enabledRef.current) flyOut(direction);
    },
    translateX,
    width,
  };
}

// Couleurs hardcodées — module level (iOS safe)
const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    top: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 3,
    zIndex: 2,
  },
  stampRight: {
    left: 18,
    borderColor: '#34C759',
    transform: [{ rotate: '-12deg' }],
  },
  stampLeft: {
    right: 18,
    borderColor: '#FF3B30',
    transform: [{ rotate: '12deg' }],
  },
  stampText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stampTextRight: { color: '#34C759' },
  stampTextLeft: { color: '#FF3B30' },
});

interface SwipeableCardProps {
  swipe: CardSwipe;
  children: React.ReactNode;
}

export default function SwipeableCard({ swipe, children }: SwipeableCardProps) {
  const { translateX, width } = swipe;
  const threshold = swipeThreshold(width);

  const rotate = translateX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const rightStampOpacity = translateX.interpolate({
    inputRange: [0, threshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const leftStampOpacity = translateX.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{ transform: [{ translateX }, { rotate }] }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, styles.stampRight, { opacity: rightStampOpacity }]}
      >
        <Text style={[styles.stampText, styles.stampTextRight]}>JE SAVAIS</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, styles.stampLeft, { opacity: leftStampOpacity }]}
      >
        <Text style={[styles.stampText, styles.stampTextLeft]}>À REVOIR</Text>
      </Animated.View>
    </Animated.View>
  );
}
