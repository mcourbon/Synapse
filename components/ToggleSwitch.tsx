// components/ToggleSwitch.tsx
// Remplace le Switch natif : sur Android il rendu avec le thème Material du
// téléphone (piste/pastille carrées, pas d'animation de glissement), ce qui
// détonne avec le reste des composants custom de l'app. Ici la piste et la
// pastille sont animées avec un spring, comme le style iOS.
import { Pressable, Animated, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const THUMB_PADDING = 3;

export default function ToggleSwitch({ value, onValueChange, disabled }: ToggleSwitchProps) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false, // la couleur de piste s'interpole en JS, pas de useNativeDriver possible ici
      tension: 300,
      friction: 22,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, theme.primary],
  });

  const thumbTranslateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_PADDING, TRACK_WIDTH - THUMB_SIZE - THUMB_PADDING],
  });

  const styles = StyleSheet.create({
    track: {
      width: TRACK_WIDTH,
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 2,
      elevation: 2,
    },
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbTranslateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}
