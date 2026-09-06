import { Pressable, type PressableProps } from "react-native";
import { useEffect } from "react";
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
  EASE_STANDARD,
  COLOR_TRANSITION_DURATION,
} from "@/utils/animations";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ChipShape = "pill" | "rounded";
export type ChipSize = "sm" | "md";

interface ChipProps extends Omit<PressableProps, "children"> {
  label: string;
  selected: boolean;
  shape?: ChipShape;
  size?: ChipSize;
  fullWidth?: boolean;
  className?: string;
}

const shapeClass: Record<ChipShape, string> = {
  pill: "rounded-full",
  rounded: "rounded-md",
};

const sizeClass: Record<ChipSize, { padding: string; text: string }> = {
  sm: { padding: "px-3 py-1.5", text: "text-xs" },
  md: { padding: "px-3 py-2", text: "text-sm" },
};

/**
 * Chip/toggle reusable para filtros y selectores de tipo (transacciones,
 * cuentas bancarias, objetivos). Reemplaza los `Pressable` sin feedback que
 * repetían este patrón en 3 pantallas — ver CLAUDE.md sobre reusar
 * primitivos de src/components/ui antes de crear uno nuevo.
 *
 * Feedback: press (scale, igual que Button) + transición de color
 * activo/inactivo vía `interpolateColor` (nunca un salto instantáneo de
 * clase). Frecuencia media (se toca al filtrar/elegir tipo) → animación
 * sutil, sin springs con rebote.
 */
export function Chip({
  label,
  selected,
  shape = "rounded",
  size = "md",
  fullWidth = false,
  className = "",
  onPressIn,
  onPressOut,
  ...props
}: ChipProps) {
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

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [c.surface, c.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [c.border, c.primary]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.foreground, c.primaryForeground]),
  }));

  const { padding, text } = sizeClass[size];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={containerStyle}
      className={`border items-center justify-center ${shapeClass[shape]} ${padding} ${fullWidth ? "flex-1" : ""} ${className}`}
      onPressIn={(e) => {
        pressIn(scale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressOut(scale);
        onPressOut?.(e);
      }}
      {...props}
    >
      <Animated.Text style={textStyle} className={`font-sans-semibold ${text}`}>
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}
