import { Tabs, router, usePathname } from "expo-router";
import { View, useWindowDimensions, type ColorValue } from "react-native";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import {
  SPRING_SPRIG,
  EASE_OUT_STRONG,
  INDICATOR_DURATION,
  useReducedMotion,
} from "@/utils/animations";
import { House, ReceiptText, Wallet, Target, User, type LucideIcon } from "@/components/ui/icons";

const TAB_INDICATOR_WIDTH = 28;

/**
 * Ícono del tab bar con un "pop" de escala sutil al enfocarse. Se toca
 * decenas de veces al día (swipe/tap entre módulos) — el spring usa
 * SPRING_SPRIG (sin rebote exagerado) y el escalado es pequeño a propósito;
 * esto es feedback de estado, no una celebración.
 */
function AnimatedTabIcon({
  Icon,
  focused,
  color,
}: {
  Icon: LucideIcon;
  focused: boolean;
  color: ColorValue;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    const target = focused ? 1.12 : 1;
    scale.value = reduceMotion ? target : withSpring(target, SPRING_SPRIG);
  }, [focused, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.25 : 2} />
    </Animated.View>
  );
}

interface TabConfig {
  name: string;
  title: string;
  icon: LucideIcon;
}

const tabs: TabConfig[] = [
  { name: "index", title: "Inicio", icon: House },
  { name: "transactions", title: "Transacciones", icon: ReceiptText },
  { name: "banking", title: "Cuentas", icon: Wallet },
  { name: "objectives", title: "Objetivos", icon: Target },
  { name: "profile", title: "Perfil", icon: User },
];

// Rutas en el mismo orden que `tabs`, para poder navegar al vecino izquierdo/
// derecho al deslizar. "index" no aparece en la URL (es la ruta raíz del grupo).
const TAB_PATHS = tabs.map((t) => (t.name === "index" ? "/" : `/${t.name}`));

// Umbrales del gesto de swipe entre módulos: exige recorrido Y velocidad
// mínima para no disparar con un roce accidental, y cede el gesto rápido si
// el dedo se mueve más vertical que horizontal (para no robarle el swipe a
// los FlatList/ScrollView verticales de cada pantalla).
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 250;

function navigateToTab(index: number): void {
  if (index < 0 || index >= TAB_PATHS.length) return;
  router.navigate(TAB_PATHS[index] as never);
}

export default function TabsLayout() {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const currentTabIndex = TAB_PATHS.indexOf(pathname);
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const tabBarHeight = 56 + insets.bottom;
  const segmentWidth = screenWidth / tabs.length;
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  useEffect(() => {
    if (currentTabIndex === -1) {
      indicatorOpacity.value = reduceMotion
        ? 0
        : withTiming(0, { duration: INDICATOR_DURATION, easing: EASE_OUT_STRONG });
      return;
    }
    const target = currentTabIndex * segmentWidth + (segmentWidth - TAB_INDICATOR_WIDTH) / 2;
    if (reduceMotion) {
      indicatorX.value = target;
      indicatorOpacity.value = 1;
    } else {
      indicatorX.value = withTiming(target, {
        duration: INDICATOR_DURATION,
        easing: EASE_OUT_STRONG,
      });
      indicatorOpacity.value = withTiming(1, { duration: INDICATOR_DURATION });
    }
  }, [currentTabIndex, segmentWidth, reduceMotion, indicatorX, indicatorOpacity]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: indicatorOpacity.value,
  }));

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (currentTabIndex === -1) return;
      if (
        e.translationX < -SWIPE_DISTANCE_THRESHOLD &&
        e.velocityX < -SWIPE_VELOCITY_THRESHOLD
      ) {
        runOnJS(navigateToTab)(currentTabIndex + 1);
      } else if (
        e.translationX > SWIPE_DISTANCE_THRESHOLD &&
        e.velocityX > SWIPE_VELOCITY_THRESHOLD
      ) {
        runOnJS(navigateToTab)(currentTabIndex - 1);
      }
    });

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <GestureDetector gesture={swipeGesture}>
        <View collapsable={false} style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              bottom: tabBarHeight - 3,
              width: TAB_INDICATOR_WIDTH,
              height: 3,
              borderRadius: 2,
              backgroundColor: c.primary,
              zIndex: 1,
            },
            indicatorStyle,
          ]}
        />
        <Tabs
          screenOptions={{
            headerShown: false,
            // Cada pantalla maneja su propio pt-*/mt-* interno asumiendo que ya
            // hay espacio libre arriba, pero nada aplicaba `insets.top` (notch,
            // Dynamic Island, cámara perforada) — el contenido quedaba pegado
            // al status bar en esos dispositivos. Se aplica acá una sola vez
            // para las 5 pantallas del tab bar en vez de repetirlo en cada una.
            sceneStyle: { paddingTop: insets.top + 12, backgroundColor: c.background },
            tabBarActiveTintColor: c.primary,
            tabBarInactiveTintColor: c.mutedForeground,
            tabBarStyle: {
              backgroundColor: c.card,
              borderTopWidth: 1,
              borderTopColor: c.border,
              height: 56 + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom,
            },
            tabBarLabelStyle: { fontSize: 11, fontFamily: "SchibstedGrotesk-SemiBold" },
          }}
        >
          {tabs.map(({ name, title, icon: Icon }) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title,
                tabBarIcon: ({ focused, color }) => (
                  <AnimatedTabIcon Icon={Icon} focused={focused} color={color} />
                ),
              }}
            />
          ))}
        </Tabs>
        </View>
      </GestureDetector>
    </View>
  );
}
