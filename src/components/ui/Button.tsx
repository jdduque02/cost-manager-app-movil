import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { pressIn, pressOut } from "@/utils/animations";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "md";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  outline: "bg-background border border-input",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
  link: "bg-transparent",
};

const textStyles: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
  link: "text-primary underline",
};

const spinnerTone: Record<ButtonVariant, keyof (typeof PALETTE)["light"]> = {
  default: "primaryForeground",
  secondary: "secondaryForeground",
  outline: "foreground",
  ghost: "foreground",
  destructive: "destructiveForeground",
  link: "primary",
};

// `md` es un alias retrocompatible de `default` (tamaño usado en toda la app
// antes de este rediseño).
const sizeStyles: Record<ButtonSize, string> = {
  default: "h-9 px-4",
  md: "h-9 px-4",
  sm: "h-8 px-3",
  lg: "h-10 px-8",
  icon: "h-9 w-9 px-0",
};

const textSizeStyles: Record<ButtonSize, string> = {
  default: "text-sm",
  md: "text-sm",
  sm: "text-xs",
  lg: "text-sm",
  icon: "text-sm",
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const { resolvedScheme } = useAppTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={animatedStyle}
      className={`rounded-md items-center flex-row justify-center gap-2 ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      disabled={isDisabled}
      onPressIn={() => pressIn(scale)}
      onPressOut={() => pressOut(scale)}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={PALETTE[resolvedScheme][spinnerTone[variant]]}
        />
      )}
      {typeof children === "string" ? (
        <Text
          className={`font-sans-medium ${textSizeStyles[size]} ${textStyles[variant]}`}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}
