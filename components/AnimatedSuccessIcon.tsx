// components/AnimatedSuccessIcon.tsx
import { View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AnimatedSuccessIconProps {
  scale: Animated.Value;
}

export default function AnimatedSuccessIcon({ scale }: AnimatedSuccessIconProps) {
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center',
          width: 100,
          height: 100,
        },
        {
          transform: [{ scale }],
        }
      ]}
    >
      <View style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}>
        <Ionicons name="checkmark" size={32} color="#fff" />
      </View>
    </Animated.View>
  );
}
