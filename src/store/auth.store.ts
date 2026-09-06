import { create } from "zustand";
import { isAxiosError } from "axios";
import { getStoredTokens, clearTokens } from "@/api/client";
import * as authApi from "@/api/auth.api";
import * as usersApi from "@/api/users.api";
import * as SecureStore from "expo-secure-store";
import { onSessionExpired } from "@/lib/session-events";
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
  handleSessionExpired: () => Promise<void>;
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
        if (!cachedUser) {
          // Token presente pero sin usuario cacheado: no hay forma confiable
          // de saber el userId real. Adivinarlo (p.ej. `?? 1`) llevaría a
          // pedir los datos de otra persona. Tratarlo como sesión inválida.
          await get().handleSessionExpired();
          return;
        }
        set({
          isAuthenticated: true,
          isOfflineMode: false,
          user: cachedUser,
          userId: cachedUser.id,
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
      const tokenData = await authApi.login(dto);

      const userId = tokenData.userId;
      if (userId) {
        await SecureStore.setItemAsync(CACHED_USER_ID_KEY, String(userId));
      }

      set({
        isAuthenticated: true,
        isOfflineMode: false,
        isLoading: false,
        userId: userId ?? null,
      });

      // Cachear el usuario completo (SQLite + store) para que sobreviva a un
      // reinicio de la app — sin esto, `initialize()` no encuentra usuario en
      // caché al reabrir y `userId` se pierde (ver [[fase-1-userid-perdido]]).
      if (userId) {
        try {
          const fullUser = await usersApi.getCurrentUser(userId);
          get().setUser(fullUser);
        } catch {
          // No bloquear el login si esta llamada falla; el usuario queda sin
          // cachear localmente pero la sesión sigue siendo válida.
        }
      }
    } catch (err: unknown) {
      console.error("[Auth] login failed:", err);
      // Sin response = fallo de red real (DNS, TLS, timeout, conexión rechazada).
      // Con response (401, etc.) = el servidor respondió pero rechazó las credenciales.
      const isNetworkError = isAxiosError(err) && !err.response;
      let message: string;
      if (isNetworkError) {
        message =
          "No se pudo conectar con el servidor. Verifica tu conexión e IP del backend.";
        if (__DEV__ && isAxiosError(err)) {
          message += ` [${err.code ?? "sin código"}: ${err.message}]`;
        }
      } else if (isAxiosError(err) && err.response) {
        const serverMessage = (err.response.data as { message?: string } | undefined)
          ?.message;
        message =
          serverMessage ??
          "Credenciales incorrectas. Verifica tu usuario y contraseña.";
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = "Credenciales incorrectas. Verifica tu usuario y contraseña.";
      }
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

  // Como logout(), pero sin llamar al endpoint (el servidor ya rechazó el
  // token) y dejando un mensaje explicando por qué se salió de la sesión.
  handleSessionExpired: async () => {
    await clearTokens();
    await clearCachedUser();
    set({
      isAuthenticated: false,
      isOfflineMode: false,
      user: null,
      userId: null,
      isLoading: false,
      error: "Tu sesión expiró, inicia sesión de nuevo",
    });
  },

  setUser: (user: UserResponse) => {
    set({ user, userId: user.id });
    cacheUser(user).catch(() => {});
  },

  clearError: () => set({ error: null }),
}));

onSessionExpired(() => {
  useAuthStore.getState().handleSessionExpired();
});
