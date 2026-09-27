import { View, Pressable, type LayoutChangeEvent } from "react-native";
import { useEffect, useState } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import {
  pressIn,
  pressOut,
  useReducedMotion,
  EASE_OUT_STRONG,
  EASE_STANDARD,
  INDICATOR_DURATION,
  COLOR_TRANSITION_DURATION,
} from "@/utils/animations";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CONTAINER_PADDING = 4;

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Toggle tipo "Lista/Calendario": en vez de repintar cada botón al cambiar
 * de opción, un pill de fondo se desliza (`translateX`) detrás de la opción
 * activa — mismo patrón/curva que el indicador del tab bar
 * (ease-out fuerte, ~200ms), y el texto cruza de color con `interpolateColor`.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const activeIndex = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const innerWidth = Math.max(containerWidth - CONTAINER_PADDING * 2, 0);
  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;

  useEffect(() => {
    if (containerWidth === 0) return;
    const target = activeIndex * segmentWidth;
    indicatorX.value = reduceMotion
      ? target
      : withTiming(target, { duration: INDICATOR_DURATION, easing: EASE_OUT_STRONG });
  }, [activeIndex, segmentWidth, containerWidth, reduceMotion, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segmentWidth,
  }));

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={handleLayout}
      className={`relative flex-row bg-surface border border-border rounded-md p-1 ${className}`}
    >
      {containerWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          className="absolute rounded bg-primary"
          style={[{ top: 4, bottom: 4, left: 4 }, indicatorStyle]}
        />
      )}
      {options.map((option, index) => (
        <SegmentedItem
          key={option.value}
          label={option.label}
          selected={index === activeIndex}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

function SegmentedItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: COLOR_TRANSITION_DURATION, easing: EASE_STANDARD });
  }, [selected, reduceMotion, progress]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.foreground, c.primaryForeground]),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={pressStyle}
      className="flex-1 items-center justify-center py-1.5 rounded"
      onPressIn={() => pressIn(scale)}
      onPressOut={() => pressOut(scale)}
      onPress={onPress}
    >
      <Animated.Text style={textStyle} className="text-sm font-sans-semibold">
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}
