import { create } from "zustand";
import {
  syncPendingOperations,
  MAX_RETRIES,
  type SyncResult,
} from "@/database/sync.service";
import { getPendingOperations } from "@/database/local.repository";

// Sincroniza automáticamente cada ~2-3 min además del disparo al reconectar,
// para no depender únicamente del evento offline→online (p.ej. si la app
// nunca perdió la conexión pero el primer intento de sync falló).
const PERIODIC_SYNC_INTERVAL_MS = 2.5 * 60 * 1000;

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  /** Operaciones que agotaron sus reintentos (MAX_RETRIES) y ya no se reintentan automáticamente. */
  skippedCount: number;
  lastSyncAt: string | null;
  lastSyncResult: SyncResult | null;

  setOnlineStatus: (online: boolean) => Promise<void>;
  sync: () => Promise<SyncResult | null>;
  refreshPendingCount: () => Promise<void>;
}

/**
 * Store global de estado offline (Zustand).
 *
 * Responsabilidades:
 * - Rastrear si la app está online o offline.
 * - Contar las operaciones pendientes de sincronización.
 * - Disparar la sincronización automáticamente al recuperar conexión.
 * - Exponer el resultado de la última sincronización.
 */
export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  skippedCount: 0,
  lastSyncAt: null,
  lastSyncResult: null,

  setOnlineStatus: async (online: boolean) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: online });

    // Si acaba de recuperar conexión, sincronizar automáticamente
    if (online && wasOffline) {
      await get().sync();
    }

    await get().refreshPendingCount();
  },

  sync: async () => {
    if (get().isSyncing) return null;
    set({ isSyncing: true });
    try {
      const result = await syncPendingOperations();
      set({
        lastSyncAt: new Date().toISOString(),
        lastSyncResult: result,
      });
      await get().refreshPendingCount();
      return result;
    } catch {
      return null;
    } finally {
      set({ isSyncing: false });
    }
  },

  refreshPendingCount: async () => {
    try {
      const ops = await getPendingOperations();
      const skipped = ops.filter((op) => op.retryCount >= MAX_RETRIES).length;
      set({ pendingCount: ops.length, skippedCount: skipped });
    } catch {
      // ignorar
    }
  },
}));

// Timer periódico: complementa el disparo en el flanco offline→online para
// cubrir el caso en que la app nunca perdió conexión pero un sync anterior
// falló. No depende de AppState (evita una segunda suscripción — el refresh
// proactivo de tokens en `api/client.ts` ya escucha foreground/background).
setInterval(() => {
  const { isOnline, isSyncing, pendingCount, skippedCount, sync } =
    useOfflineStore.getState();
  if (isOnline && !isSyncing && pendingCount > skippedCount) {
    sync();
  }
}, PERIODIC_SYNC_INTERVAL_MS);
