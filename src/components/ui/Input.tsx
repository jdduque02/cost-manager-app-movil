import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useEffect, useRef, useState } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import {
  useReducedMotion,
  shakeError,
  EASE_STANDARD,
  COLOR_TRANSITION_DURATION,
} from "@/utils/animations";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

/**
 * Transición de borde en foco/blur (interpolateColor, ~150ms ease) + shake
 * al aparecer un error. El shake usa una transición (withSequence de
 * withTiming, ver `shakeError`), no keyframes, porque `error` puede pasar de
 * vacío a con-texto varias veces seguidas mientras el usuario corrige.
 */
export function Input({ label, error, className = "", onFocus, onBlur, ...props }: InputProps) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const focusProgress = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const hadError = useRef(!!error);

  useEffect(() => {
    const target = focused ? 1 : 0;
    focusProgress.value = reduceMotion
      ? target
      : withTiming(target, { duration: COLOR_TRANSITION_DURATION, easing: EASE_STANDARD });
  }, [focused, reduceMotion, focusProgress]);

  useEffect(() => {
    const hasErrorNow = !!error;
    if (hasErrorNow && !hadError.current && !reduceMotion) {
      shakeError(shakeX);
    }
    hadError.current = hasErrorNow;
  }, [error, reduceMotion, shakeX]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
    borderColor: error
      ? c.destructive
      : interpolateColor(focusProgress.value, [0, 1], [c.input, c.ring]),
  }));

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-sans-medium text-foreground mb-1.5">{label}</Text>
      )}
      <Animated.View style={containerStyle} className="h-11 border rounded-md bg-background">
        <TextInput
          className={`flex-1 px-3 text-foreground text-sm font-sans ${className}`}
          placeholderTextColor={PALETTE[resolvedScheme].mutedForeground}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </Animated.View>
      {error && <Text className="text-destructive text-xs font-sans mt-1">{error}</Text>}
    </View>
  );
}
