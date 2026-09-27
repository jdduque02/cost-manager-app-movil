import { useState, type ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { WifiOff, RefreshCw } from "@/components/ui/icons";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

/**
 * Puramente presentacional: sólo lee del store. `app/_layout.tsx` es la única
 * fuente que escucha NetInfo y llama `setOnlineStatus` — tener una segunda
 * suscripción aquí era redundante (ambas llamaban al mismo setter con el
 * mismo valor).
 */
export function OfflineBanner() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    skippedCount,
    stuckIds,
    stuckReason,
    sync,
    retryStuck,
    discardStuck,
  } = useOfflineStore();
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  // Ids congelados al abrir el diálogo: se descarta lo que el usuario vio,
  // aunque un sync en segundo plano cambie la cola mientras decide.
  const [discardIds, setDiscardIds] = useState<number[] | null>(null);

  let banner: ReactNode = null;
  if (!isOnline) {
    banner = (
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
  } else if (skippedCount > 0 && !isSyncing) {
    // Atascadas (agotaron reintentos o el servidor las rechazó con 4xx): el
    // sync automático las salta, así que sin estos botones nunca saldrían.
    banner = (
      <View className="bg-warning px-4 py-2 flex-row items-center gap-2">
        <Text
          className="flex-1 text-xs font-sans-medium text-warning-foreground"
          numberOfLines={2}
        >
          {`${skippedCount} cambio(s) no se pudieron sincronizar${stuckReason ? `: ${stuckReason}` : ""}`}
        </Text>
        <Pressable
          onPress={() => setDiscardIds(stuckIds ?? [])}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Descartar ${skippedCount} cambio(s) que no se pudieron sincronizar`}
        >
          <Text className="text-xs font-sans-medium text-warning-foreground underline">
            Descartar
          </Text>
        </Pressable>
        <Pressable
          onPress={() => retryStuck()}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Reintentar la sincronización"
          className="flex-row items-center gap-1"
        >
          <RefreshCw size={13} color={c.warningForeground} />
          <Text className="text-xs font-sans-bold text-warning-foreground">Reintentar</Text>
        </Pressable>
      </View>
    );
  } else if (pendingCount > 0) {
    // Hay conexión pero hay pendientes por sincronizar
    banner = (
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

  return (
    <>
      {banner}
      {/* Fuera de las ramas: si arranca un sync, el diálogo abierto no se desmonta. */}
      <ConfirmModal
        visible={discardIds !== null}
        tone="destructive"
        title={`¿Descartar ${discardIds?.length ?? 0} cambio(s)?`}
        description="No se enviarán al servidor y no se podrán recuperar. Lo que creaste o editaste sin sincronizar se quitará de este dispositivo; lo que siga en el servidor volverá al actualizar."
        confirmLabel="Descartar cambios"
        onCancel={() => setDiscardIds(null)}
        onConfirm={() => {
          if (discardIds) discardStuck(discardIds);
          setDiscardIds(null);
        }}
      />
    </>
  );
}
