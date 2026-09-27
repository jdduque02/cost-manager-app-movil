// Mock ligero de react-native-reanimated para Jest.
//
// react-native-reanimated 4.x delega en react-native-worklets, cuyo módulo
// nativo (`NativeWorklets`) no existe en el entorno de test (no hay runtime
// nativo) — requerir el paquete real revienta con
// "Cannot read properties of undefined (reading 'loadUnpackers')" apenas se
// importa `react-native-reanimated/src/index.ts`, incluso a través del mock
// oficial del paquete (`react-native-reanimated/mock`), porque ese mock
// también reexporta símbolos de `./index`.
//
// Este mock es intencionalmente síncrono y no-reactivo: `withTiming`/
// `withSpring` devuelven el valor final de inmediato y `useAnimatedStyle`
// ejecuta el factory una sola vez por render. Alcanza para probar el
// contrato observable de los componentes (texto, accessibilityState,
// callbacks) — los tests de este repo no aseveran valores animados en sí
// (ver comentarios en los tests de Chip/SegmentedControl/Input/CurrencyInput).
const React = require("react");
const RN = require("react-native");

function useSharedValue(initial) {
  const [box] = React.useState(() => ({ value: initial }));
  return box;
}

function useAnimatedStyle(factory) {
  try {
    return factory();
  } catch {
    return {};
  }
}

function useDerivedValue(factory) {
  return { value: factory() };
}

const identity = (v) => v;
const withTiming = (toValue) => toValue;
const withSpring = (toValue) => toValue;
const withDelay = (_delayMs, animation) => animation;
const withSequence = (...animations) => animations[animations.length - 1];
const withRepeat = identity;

function interpolateColor(value, _inputRange, outputRange) {
  return outputRange[value >= 1 ? outputRange.length - 1 : 0];
}

function interpolate() {
  return 0;
}

const Extrapolation = { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" };

const easingIdentity = (t) => t;
const Easing = {
  linear: easingIdentity,
  ease: easingIdentity,
  quad: easingIdentity,
  cubic: easingIdentity,
  poly: easingIdentity,
  sin: easingIdentity,
  circle: easingIdentity,
  exp: easingIdentity,
  elastic: () => easingIdentity,
  back: () => easingIdentity,
  bounce: easingIdentity,
  bezier: () => easingIdentity,
  bezierFn: easingIdentity,
  steps: () => easingIdentity,
  in: () => easingIdentity,
  out: () => easingIdentity,
  inOut: () => easingIdentity,
};

function runOnJS(fn) {
  return (...args) => fn(...args);
}

function runOnUI(fn) {
  return (...args) => fn(...args);
}

function useReducedMotion() {
  return false;
}

function createAnimatedComponent(Component) {
  return Component;
}

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  FlatList: RN.FlatList,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction: () => {},
  useDerivedValue,
  useAnimatedRef: () => ({ current: null }),
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolateColor,
  interpolate,
  Extrapolation,
  Extrapolate: Extrapolation,
  Easing,
  runOnJS,
  runOnUI,
  useReducedMotion,
  createAnimatedComponent,
  cancelAnimation: () => {},
};
