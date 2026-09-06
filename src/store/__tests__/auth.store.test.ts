/**
 * Tests unitarios para src/store/auth.store.ts
 *
 * Mockea dependencias externas (authApi, local.repository, client, SecureStore)
 * para probar la lógica del store de forma aislada.
 */

import { useAuthStore } from "../auth.store";
import * as authApi from "@/api/auth.api";
import { getStoredTokens, clearTokens } from "@/api/client";
import {
  cacheUser,
  getCachedUser,
  clearCachedUser,
} from "@/database/local.repository";

jest.mock("@/api/auth.api");
jest.mock("@/api/client", () => ({
  getStoredTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock("@/database/local.repository", () => ({
  cacheUser: jest.fn(),
  getCachedUser: jest.fn(),
  clearCachedUser: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockLogin = authApi.login as jest.Mock;
const mockLogout = authApi.logout as jest.Mock;
const mockGetStoredTokens = getStoredTokens as jest.Mock;
const mockGetCachedUser = getCachedUser as jest.Mock;
const mockClearCachedUser = clearCachedUser as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;
const mockCacheUser = cacheUser as jest.Mock;

const mockUser = {
  id: 1,
  username: "testuser",
  email: "test@test.com",
  full_name: "Test User",
  is_active: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

/** Resetea el store a su estado inicial entre tests. */
function resetStore() {
  useAuthStore.setState({
    isAuthenticated: false,
    isOfflineMode: false,
    isLoading: true,
    user: null,
    userId: null,
    error: null,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  resetStore();
});

// ─── initialize ───────────────────────────────────────────────────────────────

describe("initialize", () => {
  it("autentica si hay token válido en SecureStore", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ accessToken: "valid-token" });
    mockGetCachedUser.mockResolvedValueOnce(mockUser);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isOfflineMode).toBe(false);
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
  });

  it("activa modo offline si no hay token pero hay usuario en caché", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ accessToken: null });
    mockGetCachedUser.mockResolvedValueOnce(mockUser);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isOfflineMode).toBe(true);
  });

  it("desautentica si no hay token ni caché", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ accessToken: null });
    mockGetCachedUser.mockResolvedValueOnce(null);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("autentica al usuario exitosamente", async () => {
    mockLogin.mockResolvedValueOnce({ data: [{}] });

    await useAuthStore
      .getState()
      .login({ username: "testuser", password: "Pass1234" });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("guarda el error si falla el login", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Credenciales inválidas"));

    await expect(
      useAuthStore.getState().login({ username: "user", password: "bad" }),
    ).rejects.toThrow("Credenciales inválidas");

    expect(useAuthStore.getState().error).toBe("Credenciales inválidas");
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── loginOffline ─────────────────────────────────────────────────────────────

describe("loginOffline", () => {
  it("retorna true y autentica si hay usuario en caché", async () => {
    mockGetCachedUser.mockResolvedValueOnce(mockUser);

    const result = await useAuthStore.getState().loginOffline();

    expect(result).toBe(true);
    expect(useAuthStore.getState().isOfflineMode).toBe(true);
  });

  it("retorna false si no hay usuario en caché", async () => {
    mockGetCachedUser.mockResolvedValueOnce(null);

    const result = await useAuthStore.getState().loginOffline();

    expect(result).toBe(false);
  });
});

// ─── setUser ──────────────────────────────────────────────────────────────────

describe("setUser", () => {
  it("actualiza el usuario en el store y llama a cacheUser", () => {
    mockCacheUser.mockResolvedValueOnce(undefined);

    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.userId).toBe(1);
    expect(mockCacheUser).toHaveBeenCalledWith(mockUser);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("limpia el estado y llama a clearCachedUser", async () => {
    useAuthStore.setState({ isAuthenticated: true, user: mockUser, userId: 1 });
    mockGetStoredTokens.mockResolvedValueOnce({ refreshToken: "rt" });
    mockLogout.mockResolvedValueOnce(undefined);
    mockClearCachedUser.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.userId).toBeNull();
    expect(mockClearCachedUser).toHaveBeenCalled();
  });

  it("limpia tokens si no hay refreshToken", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ refreshToken: null });
    mockClearTokens.mockResolvedValueOnce(undefined);
    mockClearCachedUser.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockClearTokens).toHaveBeenCalled();
  });
});
