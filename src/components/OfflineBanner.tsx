import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useOfflineStore } from "@/store/offline.store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useEffect } from "react";

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, setOnlineStatus, sync } =
    useOfflineStore();
  const { isConnected, isInternetReachable } = useNetworkStatus();

  useEffect(() => {
    const online = isConnected && isInternetReachable !== false;
    setOnlineStatus(online);
  }, [isConnected, isInternetReachable, setOnlineStatus]);

  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <View className="bg-yellow-500 px-4 py-2 flex-row items-center justify-between">
        <Text className="text-white text-xs font-semibold flex-1">
          ⚡ Modo offline — los cambios se guardan localmente
        </Text>
        {pendingCount > 0 && (
          <View className="bg-white rounded-full px-2 py-0.5 ml-2">
            <Text className="text-yellow-700 text-xs font-bold">
              {pendingCount}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Hay conexión pero hay pendientes por sincronizar
  return (
    <View className="bg-brand-700 px-4 py-2 flex-row items-center justify-between">
      <Text className="text-white text-xs font-semibold flex-1">
        {isSyncing
          ? "Sincronizando datos..."
          : `${pendingCount} cambio(s) pendiente(s)`}
      </Text>
      {isSyncing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <TouchableOpacity onPress={() => sync()}>
          <Text className="text-green-200 text-xs font-bold ml-3">
            Sincronizar
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
