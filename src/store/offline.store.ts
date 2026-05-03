import { create } from "zustand";
import {
  syncPendingOperations,
  type SyncResult,
} from "@/database/sync.service";
import { getPendingOperations } from "@/database/local.repository";

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
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
      set({ pendingCount: ops.length });
    } catch {
      // ignorar
    }
  },
}));
