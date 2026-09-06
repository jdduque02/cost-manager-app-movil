import "../global.css";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, router } from "expo-router";
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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { getDatabase } from "@/database/database.service";
import { ThemeProvider, useAppTheme } from "@/components/ThemeProvider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});

function RootLayoutInner() {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus);
  const { resolvedScheme } = useAppTheme();
  const wasAuthenticated = useRef(isAuthenticated);

  // Redirige a login cuando la sesión pasa de autenticada a no-autenticada
  // (expiración irrecuperable o logout), no en el montaje inicial.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

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

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        (state.isConnected ?? false) && state.isInternetReachable !== false;
      setOnlineStatus(online);
    });

    return () => unsubscribe();
  }, [initialize, setOnlineStatus]);

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
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootLayoutInner />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
