import { create } from "zustand";
import { getStoredTokens, clearTokens } from "@/api/client";
import * as authApi from "@/api/auth.api";
import * as SecureStore from "expo-secure-store";
import {
  cacheUser,
  getCachedUser,
  clearCachedUser,
} from "@/database/local.repository";
import type { LoginDto } from "@/types/auth.types";
import type { UserResponse } from "@/types/user.types";

const CACHED_USER_ID_KEY = "cached_user_id";

interface AuthState {
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  isLoading: boolean;
  user: UserResponse | null;
  userId: number | null;
  error: string | null;

  initialize: () => Promise<void>;
  login: (dto: LoginDto) => Promise<void>;
  loginOffline: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: UserResponse) => void;
  clearError: () => void;
}

/**
 * Store global de autenticación (Zustand).
 *
 * Gestiona el ciclo de vida de la sesión:
 * - initialize: se llama al arrancar la app para restaurar la sesión previa.
 * - login/logout: flujos online con Keycloak.
 * - loginOffline: autenticación sin red usando el usuario en caché SQLite.
 * - setUser: actualiza el perfil y lo persiste en SQLite + SecureStore.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isOfflineMode: false,
  isLoading: true,
  user: null,
  userId: null,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      // 1. Intentar con token válido en SecureStore
      const { accessToken } = await getStoredTokens();
      if (accessToken) {
        // Cargar usuario desde caché local si hay token
        const cachedUser = await getCachedUser();
        set({
          isAuthenticated: true,
          isOfflineMode: false,
          user: cachedUser,
          userId: cachedUser?.id ?? null,
          isLoading: false,
        });
        return;
      }

      // 2. Sin token: verificar si hay usuario en caché (modo offline)
      const cachedUser = await getCachedUser();
      if (cachedUser) {
        set({
          isAuthenticated: true,
          isOfflineMode: true,
          user: cachedUser,
          userId: cachedUser.id,
          isLoading: false,
        });
        return;
      }

      set({ isAuthenticated: false, isOfflineMode: false, isLoading: false });
    } catch {
      // Si falla todo, intentar modo offline con caché
      try {
        const cachedUser = await getCachedUser();
        if (cachedUser) {
          set({
            isAuthenticated: true,
            isOfflineMode: true,
            user: cachedUser,
            userId: cachedUser.id,
            isLoading: false,
          });
          return;
        }
      } catch {
        // ignorar
      }
      set({ isAuthenticated: false, isOfflineMode: false, isLoading: false });
    }
  },

  login: async (dto: LoginDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(dto);
      // Cachear el usuario si la respuesta lo incluye
      if (response && typeof response === "object" && "id" in response) {
        await cacheUser(response as UserResponse);
        set({
          user: response as UserResponse,
          userId: (response as UserResponse).id,
        });
      }
      set({ isAuthenticated: true, isOfflineMode: false, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar sesión";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  // Autenticación offline: usa el usuario en caché sin verificar servidor
  loginOffline: async () => {
    const cachedUser = await getCachedUser();
    if (cachedUser) {
      set({
        isAuthenticated: true,
        isOfflineMode: true,
        user: cachedUser,
        userId: cachedUser.id,
        error: null,
      });
      return true;
    }
    return false;
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const { refreshToken } = await getStoredTokens();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      } else {
        await clearTokens();
      }
    } catch {
      await clearTokens();
    } finally {
      await clearCachedUser();
      set({
        isAuthenticated: false,
        isOfflineMode: false,
        user: null,
        userId: null,
        isLoading: false,
      });
    }
  },

  setUser: (user: UserResponse) => {
    set({ user, userId: user.id });
    cacheUser(user).catch(() => {});
  },

  clearError: () => set({ error: null }),
}));
