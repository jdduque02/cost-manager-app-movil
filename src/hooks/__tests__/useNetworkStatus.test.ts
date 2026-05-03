/**
 * Tests unitarios para src/hooks/useNetworkStatus.ts
 *
 * Mockea @react-native-community/netinfo para testear el hook sin red real.
 */

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

import { renderHook, act } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkStatus, checkConnectivity } from "../useNetworkStatus";

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;
const mockFetch = NetInfo.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto simular que hay conexión
  mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  mockAddEventListener.mockReturnValue(() => {}); // devuelve función unsubscribe
});

// ─── useNetworkStatus ─────────────────────────────────────────────────────────

describe("useNetworkStatus", () => {
  it("inicia con estado online por defecto", () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
  });

  it("suscribe y desuscribe a NetInfo.addEventListener", () => {
    const unsubscribeMock = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribeMock);

    const { unmount } = renderHook(() => useNetworkStatus());

    expect(mockAddEventListener).toHaveBeenCalled();
    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it("actualiza el estado cuando cambia la conectividad", async () => {
    let capturedHandler: ((state: unknown) => void) | null = null;
    // El fetch inicial también devuelve offline para no interferir
    mockFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    mockAddEventListener.mockImplementation((handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      capturedHandler?.({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);
  });
});

// ─── checkConnectivity ────────────────────────────────────────────────────────

describe("checkConnectivity", () => {
  it("retorna true cuando hay conexión e Internet es alcanzable", async () => {
    mockFetch.mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
    });
    const result = await checkConnectivity();
    expect(result).toBe(true);
  });

  it("retorna false cuando no hay conexión", async () => {
    mockFetch.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });
    const result = await checkConnectivity();
    expect(result).toBe(false);
  });

  it("retorna false cuando hay conexión pero Internet no es alcanzable", async () => {
    mockFetch.mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: false,
    });
    const result = await checkConnectivity();
    expect(result).toBe(false);
  });
});
