import {
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";

export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

export const SPRING_SPRIG = {
  damping: 20,
  stiffness: 120,
  mass: 1,
};

export const TIMING_CONFIG = {
  duration: 200,
};

// Curvas tomadas de la skill `animate` (tabla de easing) — no inventar nuevas.
// Reexportamos `useReducedMotion` de reanimated desde este módulo para que
// todos los componentes gaten sus animaciones desde un único punto de
// entrada (facilita mockearlo en tests sin mockear reanimated entero).
export { useReducedMotion };

/** Ease-out fuerte para UI — indicadores deslizantes (tab bar, segmented control). */
export const EASE_OUT_STRONG = Easing.bezier(0.23, 1, 0.32, 1);
/** Ease-in-out fuerte — contenido que se mueve/transforma en pantalla (cross-fade). */
export const EASE_IN_OUT_STRONG = Easing.bezier(0.77, 0, 0.175, 1);
/** Ease estándar (CSS `ease`) — transiciones de color (hover/focus/selección). */
export const EASE_STANDARD = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Duración de un indicador deslizante (tab bar / segmented control). */
export const INDICATOR_DURATION = 200;
/** Duración de una transición de color (borde, chip activo/inactivo). */
export const COLOR_TRANSITION_DURATION = 160;
/** Duración del cross-fade entre vistas Lista/Calendario. */
export const CROSSFADE_DURATION = 180;
/** Duración total del shake de error en inputs. */
export const SHAKE_DURATION = 280;

export function pressIn(scale: SharedValue<number>) {
  scale.value = withSpring(0.97, SPRING_CONFIG);
}

export function pressOut(scale: SharedValue<number>) {
  scale.value = withSpring(1, SPRING_CONFIG);
}

export function fadeIn(duration = 300) {
  return withTiming(1, { duration });
}

export function fadeOut(duration = 200) {
  return withTiming(0, { duration });
}

export function slideIn(from: "left" | "right" | "bottom" | "top", distance = 50) {
  const axis = from === "left" || from === "right" ? "x" : "y";
  return {
    [axis]: withSpring(0, SPRING_CONFIG),
    opacity: withTiming(1, { duration: 250 }),
  };
}

export function staggerItem(
  index: number,
  opacity: SharedValue<number>,
  translateY: SharedValue<number>,
  baseDelay = 60,
) {
  const delay = index * baseDelay;
  opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  translateY.value = withDelay(delay, withSpring(0, SPRING_SPRIG));
}

export function pulseScale(value: SharedValue<number>, from = 0.95, to = 1.05) {
  value.value = withSpring(to, { damping: 10, stiffness: 200, mass: 0.5 });
  setTimeout(() => {
    value.value = withSpring(from, { damping: 10, stiffness: 200, mass: 0.5 });
  }, 150);
}

/**
 * Shake horizontal de error (translateX oscilante). Usa una transición
 * (withSequence de withTiming), no keyframes, porque `error` puede alternar
 * rápido entre vacío/con texto — una transición se puede reiniciar sin
 * saltar, un keyframe reinicia desde cero y se nota.
 */
export function shakeError(translateX: SharedValue<number>) {
  const step = SHAKE_DURATION / 4;
  translateX.value = withSequence(
    withTiming(-6, { duration: step, easing: Easing.out(Easing.quad) }),
    withTiming(6, { duration: step, easing: Easing.inOut(Easing.quad) }),
    withTiming(-3, { duration: step, easing: Easing.inOut(Easing.quad) }),
    withTiming(0, { duration: step, easing: Easing.out(Easing.quad) }),
  );
}
