/**
 * Tests unitarios para src/hooks/useOfflineMutations.ts.
 *
 * `createCompany`: la mutación más reciente agregada al hook (empresas
 * asociables a una transacción, ver memory/share-transaction-decision.md),
 * que no tenía cobertura. Sigue el patrón de mocking de
 * useOfflineQuery.test.tsx: mockea el offline store y la API/repo local.
 *
 * `deleteTransaction`: cobertura del flujo de borrado offline de
 * transacciones (ola 4 de deuda técnica) — en app/(tabs)/transactions.tsx
 * se quitó el bloqueo `if (!isOnline) { Alert.alert(...) }` de
 * `confirmDelete`, así que ahora SIEMPRE se llama a esta mutación, que debe
 * caer a `localRepo.deleteLocalTransaction` + cola `pending_operations`
 * (vía `refreshPendingCount`) cuando no hay conexión.
 */
import { renderHook, waitFor } from "@testing-library/react-native";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOfflineMutations, NO_SESSION_MESSAGE } from "../useOfflineMutations";
import { BLOCKED_NETWORK_MESSAGE } from "@/api/client";
import { useOfflineStore } from "@/store/offline.store";
import { useAuthStore } from "@/store/auth.store";
import * as empresasApi from "@/api/empresas.api";
import * as transactionsApi from "@/api/transactions.api";
import * as localRepo from "@/database/local.repository";

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
}));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));
jest.mock("@/api/transactions.api");
jest.mock("@/api/banking.api");
jest.mock("@/api/objectives.api");
jest.mock("@/api/empresas.api");
jest.mock("@/database/local.repository");

const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockCreateEmpresa = empresasApi.createEmpresa as jest.Mock;
const mockSaveCompanies = localRepo.saveCompanies as jest.Mock;
const mockCreateLocalCompany = localRepo.createLocalCompany as jest.Mock;
const mockDeleteTransactionApi = transactionsApi.deleteTransaction as jest.Mock;
const mockRemoveCachedTransaction = localRepo.removeCachedTransaction as jest.Mock;
const mockDeleteLocalTransaction = localRepo.deleteLocalTransaction as jest.Mock;

// Se captura la instancia de `refreshPendingCount` creada en cada llamada a
// `mockStores` para poder aseverar que el flujo offline la invoca (es la
// función que refresca el contador de la cola `pending_operations`).
let mockRefreshPendingCount: jest.Mock;

function mockStores(isOnline: boolean, userId: number | null = 5) {
  mockRefreshPendingCount = jest.fn().mockResolvedValue(undefined);
  mockUseOfflineStore.mockImplementation(
    (selector: (s: { isOnline: boolean; refreshPendingCount: () => Promise<void> }) => unknown) =>
      selector({ isOnline, refreshPendingCount: mockRefreshPendingCount }),
  );
  mockUseAuthStore.mockImplementation((selector: (s: { userId: number | null }) => unknown) =>
    selector({ userId }),
  );
}

// Sin `response` = fallo de red real (lo único, junto a 5xx, que se encola).
const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");
const httpError = (status: number, data: unknown) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, null, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useOfflineMutations - createCompany", () => {
  const dto = { name: "Empresa X" };

  it("crea en el servidor y cachea localmente cuando hay conexión", async () => {
    mockStores(true);
    const remoteResult = { id: 1, user_id: 5, name: "Empresa X", default_category_id: null };
    mockCreateEmpresa.mockResolvedValueOnce(remoteResult);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    let returned;
    await waitFor(async () => {
      returned = await result.current.createCompany(dto);
    });

    expect(mockCreateEmpresa).toHaveBeenCalledWith(5, dto);
    expect(mockSaveCompanies).toHaveBeenCalledWith([remoteResult]);
    expect(mockCreateLocalCompany).not.toHaveBeenCalled();
    expect(returned).toEqual(remoteResult);
  });

  it("cae a creación local si la petición online falla", async () => {
    mockStores(true);
    mockCreateEmpresa.mockRejectedValueOnce(networkError());
    const localResult = { id: -1, user_id: 5, name: "Empresa X", default_category_id: null };
    mockCreateLocalCompany.mockResolvedValueOnce(localResult);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    let returned;
    await waitFor(async () => {
      returned = await result.current.createCompany(dto);
    });

    expect(mockCreateLocalCompany).toHaveBeenCalledWith(5, dto);
    expect(mockSaveCompanies).not.toHaveBeenCalled();
    expect(returned).toEqual(localResult);
  });

  it("crea localmente de una vez cuando no hay conexión, sin llamar a la API", async () => {
    mockStores(false);
    const localResult = { id: -2, user_id: 5, name: "Empresa X", default_category_id: null };
    mockCreateLocalCompany.mockResolvedValueOnce(localResult);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    let returned;
    await waitFor(async () => {
      returned = await result.current.createCompany(dto);
    });

    expect(mockCreateEmpresa).not.toHaveBeenCalled();
    expect(mockCreateLocalCompany).toHaveBeenCalledWith(5, dto);
    expect(returned).toEqual(localResult);
  });
});

describe("useOfflineMutations - deleteTransaction (borrado offline)", () => {
  const transactionId = 42;

  it("borra en el servidor y limpia la caché local cuando hay conexión", async () => {
    mockStores(true);
    mockDeleteTransactionApi.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await waitFor(async () => {
      await result.current.deleteTransaction(transactionId);
    });

    expect(mockDeleteTransactionApi).toHaveBeenCalledWith(5, transactionId);
    expect(mockRemoveCachedTransaction).toHaveBeenCalledWith(transactionId);
    expect(mockDeleteLocalTransaction).not.toHaveBeenCalled();
    // El borrado online exitoso no encola nada: no debe tocar el contador
    // de pendientes de sincronización.
    expect(mockRefreshPendingCount).not.toHaveBeenCalled();
  });

  it("cae a borrado local y encola la operación si la petición online falla", async () => {
    mockStores(true);
    mockDeleteTransactionApi.mockRejectedValueOnce(networkError());
    mockDeleteLocalTransaction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await waitFor(async () => {
      await result.current.deleteTransaction(transactionId);
    });

    expect(mockDeleteTransactionApi).toHaveBeenCalledWith(5, transactionId);
    expect(mockDeleteLocalTransaction).toHaveBeenCalledWith(5, transactionId);
    expect(mockRemoveCachedTransaction).not.toHaveBeenCalled();
    expect(mockRefreshPendingCount).toHaveBeenCalledTimes(1);
  });

  it("borra localmente de una vez cuando no hay conexión, sin llamar a la API, y refresca el contador de pendientes", async () => {
    mockStores(false);
    mockDeleteLocalTransaction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await waitFor(async () => {
      await result.current.deleteTransaction(transactionId);
    });

    expect(mockDeleteTransactionApi).not.toHaveBeenCalled();
    expect(mockRemoveCachedTransaction).not.toHaveBeenCalled();
    expect(mockDeleteLocalTransaction).toHaveBeenCalledWith(5, transactionId);
    expect(mockRefreshPendingCount).toHaveBeenCalledTimes(1);
  });
});

describe("useOfflineMutations - qué errores se encolan", () => {
  const dto = { name: "Empresa X" };

  it("4xx: lanza el mensaje del API y NO guarda local ni encola", async () => {
    mockStores(true);
    mockCreateEmpresa.mockRejectedValueOnce(
      httpError(400, { status: 400, message: "Nombre duplicado", timestamp: "t" }),
    );

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await expect(result.current.createCompany(dto)).rejects.toThrow("Nombre duplicado");
    expect(mockCreateLocalCompany).not.toHaveBeenCalled();
    expect(mockRefreshPendingCount).not.toHaveBeenCalled();
  });

  it("403 de Cloud Armor (HTML): lanza 'Red no autorizada' y NO encola", async () => {
    mockStores(true);
    mockCreateEmpresa.mockRejectedValueOnce(httpError(403, "<html>403 Forbidden</html>"));

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await expect(result.current.createCompany(dto)).rejects.toThrow(BLOCKED_NETWORK_MESSAGE);
    expect(mockCreateLocalCompany).not.toHaveBeenCalled();
  });

  it("5xx: cae a la cola offline", async () => {
    mockStores(true);
    mockCreateEmpresa.mockRejectedValueOnce(httpError(503, "Service Unavailable"));
    const localResult = { id: -3, user_id: 5, name: "Empresa X", default_category_id: null };
    mockCreateLocalCompany.mockResolvedValueOnce(localResult);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await expect(result.current.createCompany(dto)).resolves.toEqual(localResult);
    expect(mockRefreshPendingCount).toHaveBeenCalledTimes(1);
  });

  it("id local (negativo): borra en local aunque haya conexión, sin llamar a la API", async () => {
    mockStores(true);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await result.current.deleteTransaction(-4);

    expect(mockDeleteTransactionApi).not.toHaveBeenCalled();
    expect(mockDeleteLocalTransaction).toHaveBeenCalledWith(5, -4);
  });

  it("sin userId: falla con error de sesión sin llamar al API ni encolar", async () => {
    mockStores(true, null);

    const { result } = renderHook(() => useOfflineMutations(), { wrapper: createWrapper() });

    await expect(result.current.createCompany(dto)).rejects.toThrow(NO_SESSION_MESSAGE);
    await expect(result.current.deleteTransaction(1)).rejects.toThrow(NO_SESSION_MESSAGE);
    expect(mockCreateEmpresa).not.toHaveBeenCalled();
    expect(mockCreateLocalCompany).not.toHaveBeenCalled();
    expect(mockDeleteTransactionApi).not.toHaveBeenCalled();
    expect(mockDeleteLocalTransaction).not.toHaveBeenCalled();
  });
});
