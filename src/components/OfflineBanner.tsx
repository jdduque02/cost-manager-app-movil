import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { WifiOff, RefreshCw } from "@/components/ui/icons";

/**
 * Puramente presentacional: sólo lee del store. `app/_layout.tsx` es la única
 * fuente que escucha NetInfo y llama `setOnlineStatus` — tener una segunda
 * suscripción aquí era redundante (ambas llamaban al mismo setter con el
 * mismo valor).
 */
export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, sync } = useOfflineStore();
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];

  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <View className="bg-warning px-4 py-2 flex-row items-center gap-2">
        <WifiOff size={14} color={c.warningForeground} />
        <Text className="flex-1 text-xs font-sans-medium text-warning-foreground">
          Modo offline — los cambios se guardan localmente
        </Text>
        {pendingCount > 0 && (
          <View className="bg-warning-foreground/15 rounded-full px-2 py-0.5">
            <Text className="text-xs font-sans-bold text-warning-foreground">{pendingCount}</Text>
          </View>
        )}
      </View>
    );
  }

  // Hay conexión pero hay pendientes por sincronizar
  return (
    <View className="bg-primary px-4 py-2 flex-row items-center gap-2">
      <Text className="flex-1 text-xs font-sans-medium text-primary-foreground">
        {isSyncing ? "Sincronizando datos..." : `${pendingCount} cambio(s) pendiente(s)`}
      </Text>
      {isSyncing ? (
        <ActivityIndicator size="small" color={c.primaryForeground} />
      ) : (
        <Pressable onPress={() => sync()} className="flex-row items-center gap-1">
          <RefreshCw size={13} color={c.primaryForeground} />
          <Text className="text-xs font-sans-bold text-primary-foreground">Sincronizar</Text>
        </Pressable>
      )}
    </View>
  );
}
