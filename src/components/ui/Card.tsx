import { View, Pressable, StyleSheet, type PressableProps } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { pressIn, pressOut } from "@/utils/animations";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// RN no puede expresar `0 18px 50px -20px` (offset negativo/spread) — se
// compensa bajando el radio y el offset. iOS lee shadowColor/Offset/Opacity/
// Radius; Android lee `elevation` (más shadowColor desde API 28, por eso se
// fija en ambos).
const ELEVATION = {
  light: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  dark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 8,
  },
};

type CardVariant =
  | "gradient"
  | "flat"
  | "outline"
  // alias retrocompatibles
  | "default"
  | "elevated"
  | "outlined";

function normalizeVariant(variant: CardVariant): "gradient" | "flat" | "outline" {
  if (variant === "default" || variant === "elevated") return "gradient";
  if (variant === "outlined") return "outline";
  return variant;
}

interface CardProps extends Omit<PressableProps, "style"> {
  variant?: CardVariant;
  /** Clases para la capa de contenido (padding, layout interno). */
  className?: string;
  /** Clases para el wrapper exterior (radio, borde, margen). */
  containerClassName?: string;
  children: React.ReactNode;
}

export function Card({
  children,
  variant = "gradient",
  className = "",
  containerClassName = "",
  onPress,
  ...rest
}: CardProps) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const v = normalizeVariant(variant);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shadow = v === "outline" ? null : ELEVATION[resolvedScheme];
  const backgroundColor = v === "outline" ? "transparent" : c.gradientCardFrom;

  const content = (
    <>
      {v === "gradient" && (
        <LinearGradient
          colors={[c.gradientCardFrom, c.gradientCardTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.34, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View className={`p-5 ${className}`}>{children}</View>
    </>
  );

  const wrapperClassName = `rounded-2xl border border-border overflow-hidden ${containerClassName}`;

  if (!onPress) {
    return (
      <Animated.View
        className={wrapperClassName}
        style={[animatedStyle, { backgroundColor }, shadow]}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      className={wrapperClassName}
      style={[animatedStyle, { backgroundColor }, shadow]}
      onPressIn={() => pressIn(scale)}
      onPressOut={() => pressOut(scale)}
      onPress={onPress}
      {...rest}
    >
      {content}
    </AnimatedPressable>
  );
}
