/**
 * Tests de renderizado para src/components/OfflineBanner.tsx
 *
 * Verifica que el banner se muestre/oculte correctamente según el estado
 * de conectividad y operaciones pendientes.
 */

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
}));

jest.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: jest.fn(),
}));

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { OfflineBanner } from "../OfflineBanner";
import { useOfflineStore } from "@/store/offline.store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;
const mockUseNetworkStatus = useNetworkStatus as jest.Mock;

/** Helper para configurar el estado del store offline */
function setupOfflineStore(overrides: {
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  setOnlineStatus?: jest.Mock;
  sync?: jest.Mock;
}) {
  const defaults = {
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    setOnlineStatus: jest.fn(),
    sync: jest.fn(),
  };
  const state = { ...defaults, ...overrides };
  // El componente puede llamar al store con o sin selector
  mockUseOfflineStore.mockImplementation(
    (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNetworkStatus.mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

// ─── OfflineBanner ────────────────────────────────────────────────────────────

describe("OfflineBanner", () => {
  it("no renderiza nada cuando está online sin pendientes", () => {
    setupOfflineStore({ isOnline: true, pendingCount: 0 });

    const { toJSON } = render(<OfflineBanner />);

    expect(toJSON()).toBeNull();
  });

  it("muestra el banner de modo offline cuando no hay conexión", () => {
    setupOfflineStore({ isOnline: false, pendingCount: 0 });

    render(<OfflineBanner />);

    expect(screen.getByText(/Modo offline/i)).toBeTruthy();
  });

  it("muestra el contador de cambios pendientes en modo offline", () => {
    setupOfflineStore({ isOnline: false, pendingCount: 3 });

    render(<OfflineBanner />);

    expect(screen.getByText("3")).toBeTruthy();
  });

  it("muestra el banner de sincronización pendiente cuando está online con pendientes", () => {
    setupOfflineStore({ isOnline: true, pendingCount: 2, isSyncing: false });

    render(<OfflineBanner />);

    expect(screen.getByText(/2 cambio/i)).toBeTruthy();
    expect(screen.getByText(/Sincronizar/i)).toBeTruthy();
  });

  it("muestra indicador de carga mientras sincroniza", () => {
    setupOfflineStore({ isOnline: true, pendingCount: 1, isSyncing: true });

    render(<OfflineBanner />);

    expect(screen.getByText(/Sincronizando/i)).toBeTruthy();
  });

  it("llama a sync al presionar el botón Sincronizar", () => {
    const mockSyncFn = jest.fn();
    setupOfflineStore({ isOnline: true, pendingCount: 1, sync: mockSyncFn });

    render(<OfflineBanner />);

    fireEvent.press(screen.getByText(/Sincronizar/i));

    expect(mockSyncFn).toHaveBeenCalled();
  });
});
