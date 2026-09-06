import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from "react-native-reanimated";

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 120,
  mass: 1,
};

interface AnimatedListItemProps {
  index: number;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedListItem({
  index,
  children,
  delay = 60,
  className,
}: AnimatedListItemProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const d = index * delay;
    opacity.value = withDelay(d, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(d, withSpring(0, SPRING_CONFIG));
  }, [index, delay, opacity, translateY]);

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
