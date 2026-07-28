// components/ProfessionalProgressCircle.tsx
import { View, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProfessionalProgressCircleProps {
  progress: Animated.Value;
  size?: number;
  theme: any;
}

export default function ProfessionalProgressCircle({ progress, size = 100, theme }: ProfessionalProgressCircleProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          {/* Gradient pour le fond - adapté au thème */}
          <LinearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? "#2a2a2a" : "#f8f9fa"} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.isDark ? "#1a1a1a" : "#e9ecef"} stopOpacity="1" />
          </LinearGradient>

          {/* Gradient pour la progression */}
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4CAF50" stopOpacity="1" />
            <Stop offset="50%" stopColor="#8BC34A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#CDDC39" stopOpacity="1" />
          </LinearGradient>

          {/* Ombre pour la profondeur - adapté au thème */}
          <LinearGradient id="shadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.isDark ? "#000000" : "#000000"} stopOpacity={theme.isDark ? 0.3 : 0.1} />
            <Stop offset="100%" stopColor={theme.isDark ? "#000000" : "#000000"} stopOpacity={theme.isDark ? 0.1 : 0.05} />
          </LinearGradient>
        </Defs>

        {/* Ombre du cercle de fond */}
        <Circle
          cx={size / 2 + 1}
          cy={size / 2 + 1}
          r={radius}
          stroke="url(#shadowGradient)"
          strokeWidth="8"
          fill="none"
          opacity={0.3}
        />

        {/* Cercle de fond */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#backgroundGradient)"
          strokeWidth="8"
          fill="none"
        />

        {/* Cercle de progression animé */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* Cercle intérieur pour l'effet 3D - adapté au thème */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 12}
          stroke={theme.isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.1)"}
          strokeWidth="1"
          fill="none"
        />
      </Svg>
    </View>
  );
}
