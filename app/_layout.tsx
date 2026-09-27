import "../global.css";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, router, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from "@expo-google-fonts/schibsted-grotesk";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore, startPeriodicSync, stopPeriodicSync } from "@/store/offline.store";
import { getDatabase } from "@/database/database.service";
import { ThemeProvider, useAppTheme } from "@/components/ThemeProvider";
import { AppToast } from "@/components/ui/Toast";

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus);
  const { resolvedScheme } = useAppTheme();
  const wasAuthenticated = useRef(isAuthenticated);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const rootNavigationState = useRootNavigationState();

  // Redirige a login cuando la sesión pasa de autenticada a no-autenticada
  // (expiración irrecuperable o logout), no en el montaje inicial.
  // Guard: no llamar a router.replace hasta que el Stack/NavigationContainer
  // esté montado (rootNavigationState.key listo); si el guard corta temprano,
  // NO se actualiza wasAuthenticated.current para que la transición true->false
  // ocurrida mientras el navigator no estaba listo se detecte igual cuando
  // rootNavigationState.key cambie y el efecto reevalúe.
  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (wasAuthenticated.current && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, rootNavigationState?.key]);

  const [fontsLoaded] = useFonts({
    "SpaceGrotesk-Medium": SpaceGrotesk_500Medium,
    "SpaceGrotesk-SemiBold": SpaceGrotesk_600SemiBold,
    "SpaceGrotesk-Bold": SpaceGrotesk_700Bold,
    "SchibstedGrotesk-Regular": SchibstedGrotesk_400Regular,
    "SchibstedGrotesk-Medium": SchibstedGrotesk_500Medium,
    "SchibstedGrotesk-SemiBold": SchibstedGrotesk_600SemiBold,
    "SchibstedGrotesk-Bold": SchibstedGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    getDatabase().catch(() => {});
    initialize();
    // Sync periódico de la cola pending_operations. Se arranca explícitamente
    // aquí (y no al importar offline.store) para que los tests que importan el
    // store no queden con un setInterval vivo que impida salir al worker.
    startPeriodicSync();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        (state.isConnected ?? false) && state.isInternetReachable !== false;
      setOnlineStatus(online);
    });

    return () => {
      stopPeriodicSync();
      unsubscribe();
    };
  }, [initialize, setOnlineStatus]);

  // Contenido compartido desde otra app (SMS/notificación de banco reenviada
  // manualmente vía share sheet nativo, ver memory/share-transaction-decision.md).
  // Solo interesa `shareIntent.text` — imágenes/archivos no están habilitados
  // en el plugin (androidIntentFilters: ["text/*"]).
  // Guard: igual que el redirect de sesión expirada más arriba, no navegar
  // hasta que el Stack/NavigationContainer esté listo (rootNavigationState.key)
  // — un share intent puede llegar en cold start antes de que exista contexto
  // de navegación, y `router.push` ahí revienta con "Couldn't find a
  // navigation context". No se limpia `shareIntent` (no se llama
  // resetShareIntent) hasta que el guard pasa, así el efecto simplemente
  // reintenta cuando `rootNavigationState.key` cambie sin perder el intent.
  useEffect(() => {
    if (
      !hasShareIntent ||
      !shareIntent?.text ||
      !isAuthenticated ||
      !rootNavigationState?.key
    )
      return;
    const text = shareIntent.text;
    resetShareIntent();
    router.push({ pathname: "/shared-transaction", params: { text } });
  }, [
    hasShareIntent,
    shareIntent,
    isAuthenticated,
    resetShareIntent,
    rootNavigationState?.key,
  ]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} className={resolvedScheme === "dark" ? "dark" : ""}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 250,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="sessions" />
        <Stack.Screen name="access-history" />
        <Stack.Screen name="statement-import" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="intelligence" />
        <Stack.Screen name="empresas" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="news" />
        <Stack.Screen name="objectives/[id]" />
        <Stack.Screen name="shared-transaction" options={{ presentation: "modal" }} />
      </Stack>
      <AppToast />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <RootLayoutInner />
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
