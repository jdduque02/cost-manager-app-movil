import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { getDatabase } from "@/database/database.service";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 min
      networkMode: "always", // permitir queries en modo offline
    },
    mutations: {
      networkMode: "always",
    },
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus);

  useEffect(() => {
    // Inicializar base de datos SQLite
    getDatabase().catch(() => {});

    // Inicializar auth (con soporte offline)
    initialize();

    // Suscribirse a cambios de red
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        (state.isConnected ?? false) && state.isInternetReachable !== false;
      setOnlineStatus(online);
    });

    return () => unsubscribe();
  }, [initialize, setOnlineStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
