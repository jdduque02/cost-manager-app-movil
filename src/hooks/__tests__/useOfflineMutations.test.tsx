/**
 * Tests unitarios para src/hooks/useOfflineMutations.ts — se enfoca en
 * `createCompany`, la mutación más reciente agregada al hook (empresas
 * asociables a una transacción, ver memory/share-transaction-decision.md),
 * que no tenía cobertura. Sigue el patrón de mocking de
 * useOfflineQuery.test.tsx: mockea el offline store y la API/repo local.
 */
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOfflineMutations } from "../useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import { useAuthStore } from "@/store/auth.store";
import * as empresasApi from "@/api/empresas.api";
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

function mockStores(isOnline: boolean) {
  mockUseOfflineStore.mockImplementation(
    (selector: (s: { isOnline: boolean; refreshPendingCount: () => Promise<void> }) => unknown) =>
      selector({ isOnline, refreshPendingCount: jest.fn().mockResolvedValue(undefined) }),
  );
  mockUseAuthStore.mockImplementation((selector: (s: { userId: number }) => unknown) =>
    selector({ userId: 5 }),
  );
}

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
    mockCreateEmpresa.mockRejectedValueOnce(new Error("network error"));
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
