/**
 * Tests unitarios para src/store/offline.store.ts
 *
 * Mockea sync.service y local.repository para probar la lógica del store.
 */

import { useOfflineStore, stopPeriodicSync } from "../offline.store";
import { syncPendingOperations } from "@/database/sync.service";
import { getPendingOperations, resetStuckOperations } from "@/database/local.repository";

jest.mock("@/database/sync.service", () => ({
  syncPendingOperations: jest.fn(),
  MAX_RETRIES: 3,
}));

jest.mock("@/database/local.repository", () => ({
  getPendingOperations: jest.fn(),
  resetStuckOperations: jest.fn(),
}));

const mockSync = syncPendingOperations as jest.Mock;
const mockGetPending = getPendingOperations as jest.Mock;
const mockResetStuck = resetStuckOperations as jest.Mock;

const mockSyncResult = { synced: 2, failed: 0, skipped: 0 };

function resetStore() {
  useOfflineStore.setState({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastSyncResult: null,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  resetStore();
});

afterEach(() => {
  // El módulo registra un setInterval periódico a nivel de módulo; pararlo
  // aquí evita que el worker no termine (antes la suite "pasaba" solo por
  // el force-exit de Jest — ver auditoría de tests de sept/2026).
  stopPeriodicSync();
});

// ─── setOnlineStatus ──────────────────────────────────────────────────────────

describe("setOnlineStatus", () => {
  it("actualiza el estado a online", async () => {
    mockGetPending.mockResolvedValueOnce([]);

    await useOfflineStore.getState().setOnlineStatus(true);

    expect(useOfflineStore.getState().isOnline).toBe(true);
  });

  it("actualiza el estado a offline", async () => {
    mockGetPending.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    await useOfflineStore.getState().setOnlineStatus(false);

    expect(useOfflineStore.getState().isOnline).toBe(false);
    expect(useOfflineStore.getState().pendingCount).toBe(2);
  });

  it("dispara sincronización automática al recuperar conexión", async () => {
    useOfflineStore.setState({ isOnline: false });
    mockSync.mockResolvedValueOnce(mockSyncResult);
    mockGetPending.mockResolvedValue([]);

    await useOfflineStore.getState().setOnlineStatus(true);

    expect(mockSync).toHaveBeenCalled();
  });

  it("no sincroniza si ya estaba online", async () => {
    useOfflineStore.setState({ isOnline: true });
    mockGetPending.mockResolvedValueOnce([]);

    await useOfflineStore.getState().setOnlineStatus(true);

    expect(mockSync).not.toHaveBeenCalled();
  });
});

// ─── sync ─────────────────────────────────────────────────────────────────────

describe("sync", () => {
  it("ejecuta sincronización y actualiza lastSyncResult", async () => {
    mockSync.mockResolvedValueOnce(mockSyncResult);
    mockGetPending.mockResolvedValueOnce([]);

    const result = await useOfflineStore.getState().sync();

    expect(result).toEqual(mockSyncResult);
    expect(useOfflineStore.getState().lastSyncResult).toEqual(mockSyncResult);
    expect(useOfflineStore.getState().lastSyncAt).not.toBeNull();
    expect(useOfflineStore.getState().isSyncing).toBe(false);
  });

  it("retorna null si ya está sincronizando (guard de doble ejecución)", async () => {
    useOfflineStore.setState({ isSyncing: true });

    const result = await useOfflineStore.getState().sync();

    expect(result).toBeNull();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("retorna null si syncPendingOperations lanza error", async () => {
    mockSync.mockRejectedValueOnce(new Error("Network fail"));
    mockGetPending.mockResolvedValueOnce([]);

    const result = await useOfflineStore.getState().sync();

    expect(result).toBeNull();
    expect(useOfflineStore.getState().isSyncing).toBe(false);
  });
});

// ─── refreshPendingCount ──────────────────────────────────────────────────────

describe("refreshPendingCount", () => {
  it("actualiza pendingCount con las operaciones pendientes", async () => {
    mockGetPending.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    await useOfflineStore.getState().refreshPendingCount();

    expect(useOfflineStore.getState().pendingCount).toBe(3);
  });

  it("mantiene el conteo en 0 si no hay operaciones pendientes", async () => {
    mockGetPending.mockResolvedValueOnce([]);

    await useOfflineStore.getState().refreshPendingCount();

    expect(useOfflineStore.getState().pendingCount).toBe(0);
  });

  it("maneja errores silenciosamente sin alterar el estado", async () => {
    mockGetPending.mockRejectedValueOnce(new Error("DB error"));
    useOfflineStore.setState({ pendingCount: 5 });

    await useOfflineStore.getState().refreshPendingCount();

    // No debe lanzar y el count previo puede mantenerse
    expect(useOfflineStore.getState().pendingCount).toBe(5);
  });

  it("cuenta como atascadas las que agotaron reintentos y expone el motivo del 4xx", async () => {
    mockGetPending.mockResolvedValueOnce([
      { id: 1, retryCount: 0, lastError: null },
      { id: 2, retryCount: 3, lastError: null },
      { id: 3, retryCount: 3, lastError: "Cuenta duplicada" },
    ]);

    await useOfflineStore.getState().refreshPendingCount();

    expect(useOfflineStore.getState().skippedCount).toBe(2);
    expect(useOfflineStore.getState().stuckReason).toBe("Cuenta duplicada");
  });
});

// ─── retryStuck ───────────────────────────────────────────────────────────────

describe("retryStuck", () => {
  it("reinicia el contador de las atascadas (sin borrarlas) y sincroniza", async () => {
    mockResetStuck.mockResolvedValueOnce(undefined);
    mockSync.mockResolvedValueOnce(mockSyncResult);
    mockGetPending.mockResolvedValue([]);

    const result = await useOfflineStore.getState().retryStuck();

    expect(mockResetStuck).toHaveBeenCalledWith(3);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockSyncResult);
  });

  it("no hace nada si ya hay una sincronización en curso", async () => {
    useOfflineStore.setState({ isSyncing: true });

    expect(await useOfflineStore.getState().retryStuck()).toBeNull();
    expect(mockResetStuck).not.toHaveBeenCalled();
  });
});
