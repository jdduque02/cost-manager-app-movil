/**
 * Tests unitarios para src/hooks/useOfflineQuery.ts
 *
 * Mockea el offline store y verifica que el hook use el fallback local
 * cuando no hay conexión o la petición remota falla.
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOfflineQuery } from "../useOfflineQuery";
import { useOfflineStore } from "@/store/offline.store";

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
}));

const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;

/** Envuelve el hook con QueryClientProvider. */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── useOfflineQuery ──────────────────────────────────────────────────────────

describe("useOfflineQuery", () => {
  it("usa la queryFn online cuando hay conexión", async () => {
    mockUseOfflineStore.mockImplementation(
      (selector: (s: { isOnline: boolean }) => unknown) =>
        selector({ isOnline: true }),
    );
    const onlineFn = jest.fn().mockResolvedValue({ id: 1, name: "Test" });
    const localFallback = jest.fn().mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useOfflineQuery(
          { queryKey: ["test"], queryFn: onlineFn },
          localFallback,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlineFn).toHaveBeenCalled();
    expect(localFallback).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ id: 1, name: "Test" });
  });

  it("usa el fallback local cuando no hay conexión", async () => {
    mockUseOfflineStore.mockImplementation(
      (selector: (s: { isOnline: boolean }) => unknown) =>
        selector({ isOnline: false }),
    );
    const onlineFn = jest.fn();
    const localFallback = jest.fn().mockResolvedValue([{ id: 99 }]);

    const { result } = renderHook(
      () =>
        useOfflineQuery(
          { queryKey: ["test-offline"], queryFn: onlineFn },
          localFallback,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlineFn).not.toHaveBeenCalled();
    expect(localFallback).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: 99 }]);
  });

  it("cae al fallback si la petición online lanza un error", async () => {
    mockUseOfflineStore.mockImplementation(
      (selector: (s: { isOnline: boolean }) => unknown) =>
        selector({ isOnline: true }),
    );
    const onlineFn = jest.fn().mockRejectedValue(new Error("Server error"));
    const localFallback = jest.fn().mockResolvedValue([{ id: 77 }]);

    const { result } = renderHook(
      () =>
        useOfflineQuery(
          { queryKey: ["test-fallback"], queryFn: onlineFn },
          localFallback,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(localFallback).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: 77 }]);
  });
});
