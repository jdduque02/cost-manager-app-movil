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
  migrateGuestDataToUser,
  GUEST_USER_ID,
} from "@/database/local.repository";
import * as SecureStore from "expo-secure-store";

jest.mock("@/api/auth.api");
jest.mock("@/api/users.api");
jest.mock("@/api/client", () => ({
  getStoredTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock("@/database/local.repository", () => ({
  cacheUser: jest.fn(),
  getCachedUser: jest.fn(),
  clearCachedUser: jest.fn(),
  migrateGuestDataToUser: jest.fn(),
  GUEST_USER_ID: -1,
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
const mockMigrateGuestDataToUser = migrateGuestDataToUser as jest.Mock;
const mockSecureStoreGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSecureStoreDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

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
    isGuest: false,
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

  it("desautentica si no hay token, caché ni marca de modo invitado", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ accessToken: null });
    mockGetCachedUser.mockResolvedValueOnce(null);
    mockSecureStoreGetItem.mockResolvedValueOnce(null);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isGuest).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("restaura el modo invitado si no hay token ni caché pero sí marca de invitado activa", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ accessToken: null });
    mockGetCachedUser.mockResolvedValueOnce(null);
    mockSecureStoreGetItem.mockResolvedValueOnce("1");

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(true);
    expect(state.userId).toBe(GUEST_USER_ID);
    expect(state.isLoading).toBe(false);
  });
});

// ─── continueAsGuest ────────────────────────────────────────────────────────

describe("continueAsGuest", () => {
  it("activa el modo invitado con el sentinel local y persiste la marca en SecureStore", async () => {
    mockGetCachedUser.mockResolvedValueOnce(null);

    await useAuthStore.getState().continueAsGuest();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(true);
    expect(state.userId).toBe(GUEST_USER_ID);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "guest_mode_active_v1",
      "1",
    );
  });

  it("prioriza una sesión real cacheada existente en vez de degradar a invitado", async () => {
    mockGetCachedUser.mockResolvedValueOnce(mockUser);

    await useAuthStore.getState().continueAsGuest();

    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(false);
    expect(state.userId).toBe(mockUser.id);
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

  it("migra los datos de invitado al usuario real cuando el login exitoso viene de modo invitado", async () => {
    useAuthStore.setState({ isGuest: true, userId: GUEST_USER_ID });
    mockLogin.mockResolvedValueOnce({ userId: 7 });
    mockMigrateGuestDataToUser.mockResolvedValueOnce(undefined);

    await useAuthStore
      .getState()
      .login({ username: "testuser", password: "Pass1234" });

    expect(mockMigrateGuestDataToUser).toHaveBeenCalledWith(7);
    expect(useAuthStore.getState().isGuest).toBe(false);
    expect(mockSecureStoreDeleteItem).toHaveBeenCalledWith("guest_mode_active_v1");
  });

  it("no borra la marca de invitado si la migración de datos falla, para poder reintentar", async () => {
    useAuthStore.setState({ isGuest: true, userId: GUEST_USER_ID });
    mockLogin.mockResolvedValueOnce({ userId: 7 });
    mockMigrateGuestDataToUser.mockRejectedValueOnce(new Error("db error"));

    await useAuthStore
      .getState()
      .login({ username: "testuser", password: "Pass1234" });

    expect(mockMigrateGuestDataToUser).toHaveBeenCalledWith(7);
    expect(mockSecureStoreDeleteItem).not.toHaveBeenCalledWith(
      "guest_mode_active_v1",
    );
  });

  it("no migra ni borra la marca de invitado si el login no trae un userId utilizable", async () => {
    useAuthStore.setState({ isGuest: true, userId: GUEST_USER_ID });
    mockLogin.mockResolvedValueOnce({});

    await useAuthStore
      .getState()
      .login({ username: "testuser", password: "Pass1234" });

    expect(mockMigrateGuestDataToUser).not.toHaveBeenCalled();
    expect(mockSecureStoreDeleteItem).not.toHaveBeenCalledWith(
      "guest_mode_active_v1",
    );
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
    expect(state.isGuest).toBe(false);
    expect(mockClearCachedUser).toHaveBeenCalled();
    expect(mockSecureStoreDeleteItem).toHaveBeenCalledWith("guest_mode_active_v1");
  });

  it("limpia tokens si no hay refreshToken", async () => {
    mockGetStoredTokens.mockResolvedValueOnce({ refreshToken: null });
    mockClearTokens.mockResolvedValueOnce(undefined);
    mockClearCachedUser.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockClearTokens).toHaveBeenCalled();
  });
});
