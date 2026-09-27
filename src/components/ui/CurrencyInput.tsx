import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, type TextInputProps } from "react-native";
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

interface CurrencyInputProps
  extends Omit<TextInputProps, "value" | "onChangeText" | "keyboardType"> {
  label?: string;
  error?: string;
  /** Monto crudo: dígitos + "." decimal opcional, sin separadores de miles (ej. "1234567.89"). */
  value: string;
  onChangeValue: (raw: string) => void;
}

/**
 * Montos de muestra en formato es-CO que cicla el placeholder animado
 * cuando el campo está vacío y sin foco — propósito "explanation": mostrar
 * el formato esperado (miles con ".") antes de que el usuario escriba nada.
 */
export const SAMPLE_AMOUNTS = ["150.000", "45.900", "1.200.000"];
const SAMPLE_HOLD_MS = 2500;
const SAMPLE_TRANSITION_MS = 200;

/**
 * Normaliza la entrada del usuario a un monto crudo: dígitos + "." decimal
 * opcional (máx. 2 posiciones), sin separadores de miles. Misma lógica que
 * el CurrencyInput del front web (currency-input.tsx) para que ambos
 * clientes formateen/acepten decimales igual.
 */
function parseUserInput(input: string): string {
  if (!input) return "";

  // Coma = decimal (teclado es-CO / decimal explícito)
  if (input.includes(",")) {
    let s = input.replace(/[^0-9.,]/g, "");
    s = s.replace(/\./g, "");
    const i = s.indexOf(",");
    const intPart = s.slice(0, i).replace(/\D/g, "");
    const decPart = s
      .slice(i + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    if (!intPart && !decPart) return "";
    return `${intPart || "0"}.${decPart}`;
  }

  const s = input.replace(/[^0-9.]/g, "");
  if (!s) return "";

  const parts = s.split(".");
  if (parts.length === 1) return parts[0];

  // Varios puntos → separadores de miles (1.234.567)
  if (parts.length > 2) return parts.join("");

  // Un solo punto: "4.8900" (miles mientras se sigue escribiendo) vs "4.99" (decimal)
  const after = parts[1] ?? "";
  if (after.length >= 3) return parts[0] + after;
  return parts[0] + "." + after.slice(0, 2);
}

/** Formatea el monto crudo para mostrar en es-CO (miles con ".", decimal con ","). */
function formatDisplay(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const dot = cleaned.indexOf(".");
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)) || "0";
  const hasDecimal = dot !== -1;
  const decPart = hasDecimal ? cleaned.slice(dot + 1).slice(0, 2) : "";

  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (hasDecimal) return `${withThousands},${decPart}`;
  return withThousands;
}

export function CurrencyInput({
  label,
  error,
  value,
  onChangeValue,
  className = "",
  onFocus,
  onBlur,
  ...props
}: CurrencyInputProps) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));
  const [focused, setFocused] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const focusProgress = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const sampleOpacity = useSharedValue(1);
  const sampleTranslateY = useSharedValue(0);
  const hadError = useRef(!!error);

  // Reajusta el display cuando `value` cambia por fuera (ej. reset de form)
  // durante el render en vez de en un efecto, para no disparar un render
  // adicional después del commit (patrón "Adjusting state on prop change").
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDisplayValue(formatDisplay(value));
  }

  const showSample = !focused && !displayValue;

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

  // Cicla los montos de muestra mientras el campo está vacío y sin foco.
  // Se congela en la primera muestra con reduced motion, y se detiene apenas
  // el usuario enfoca o escribe algo (gated por `showSample` en las deps).
  useEffect(() => {
    if (!showSample || reduceMotion) return;
    // Por si quedó a mitad de una transición de una ronda anterior (blur ->
    // focus -> blur rápido), arranca siempre visible en la muestra actual.
    sampleOpacity.value = 1;
    sampleTranslateY.value = 0;
    const interval = setInterval(() => {
      sampleOpacity.value = withTiming(0, { duration: SAMPLE_TRANSITION_MS });
      sampleTranslateY.value = withTiming(-3, { duration: SAMPLE_TRANSITION_MS });
      setTimeout(() => {
        setSampleIndex((i) => (i + 1) % SAMPLE_AMOUNTS.length);
        sampleTranslateY.value = 3;
        sampleOpacity.value = withTiming(1, { duration: SAMPLE_TRANSITION_MS });
        sampleTranslateY.value = withTiming(0, { duration: SAMPLE_TRANSITION_MS });
      }, SAMPLE_TRANSITION_MS);
    }, SAMPLE_HOLD_MS);
    return () => clearInterval(interval);
  }, [showSample, reduceMotion, sampleOpacity, sampleTranslateY]);

  const handleChangeText = useCallback(
    (text: string) => {
      const raw = parseUserInput(text);
      setDisplayValue(formatDisplay(raw));
      onChangeValue(raw);
    },
    [onChangeValue],
  );

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
    borderColor: error
      ? c.destructive
      : interpolateColor(focusProgress.value, [0, 1], [c.input, c.ring]),
  }));

  const sampleStyle = useAnimatedStyle(() => ({
    opacity: sampleOpacity.value,
    transform: [{ translateY: sampleTranslateY.value }],
  }));

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-sans-medium text-foreground mb-1.5">{label}</Text>
      )}
      <Animated.View
        style={containerStyle}
        className={`h-11 flex-row items-center border rounded-md bg-background ${className}`}
      >
        <Text className="pl-3 text-sm font-sans text-muted-foreground">$</Text>
        <View className="flex-1 h-full justify-center">
          <TextInput
            className="h-full pl-1.5 pr-3 text-foreground text-sm font-sans"
            placeholderTextColor={PALETTE[resolvedScheme].mutedForeground}
            keyboardType="decimal-pad"
            value={displayValue}
            onChangeText={handleChangeText}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
            // El placeholder nativo se reemplaza por el overlay de montos de
            // muestra animado (`showSample`) — pasar ambos duplicaría el texto.
            placeholder={undefined}
          />
          {showSample && !reduceMotion && (
            <Animated.Text
              pointerEvents="none"
              style={sampleStyle}
              className="absolute pl-1.5 text-sm font-sans text-muted-foreground"
            >
              {SAMPLE_AMOUNTS[sampleIndex]}
            </Animated.Text>
          )}
          {showSample && reduceMotion && (
            <Text
              pointerEvents="none"
              className="absolute pl-1.5 text-sm font-sans text-muted-foreground"
            >
              {SAMPLE_AMOUNTS[0]}
            </Text>
          )}
        </View>
      </Animated.View>
      {error && <Text className="text-destructive text-xs font-sans mt-1">{error}</Text>}
    </View>
  );
}
