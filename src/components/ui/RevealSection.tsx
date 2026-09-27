import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Port del `RevealSection` de la web: mismo stagger (0/100/200/300/400ms) y
// la misma curva `cubic-bezier(0.16, 1, 0.3, 1)`. En RN no hay
// IntersectionObserver — dispara al montar, que es el equivalente correcto
// para una pantalla que ya está en foco.
const EASE_OUT_SOFT = Easing.bezier(0.16, 1, 0.3, 1);

interface RevealSectionProps {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function RevealSection({ delay = 0, className = "", children }: RevealSectionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: EASE_OUT_SOFT }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: EASE_OUT_SOFT }));
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle} className={className}>
      {children}
    </Animated.View>
  );
}
