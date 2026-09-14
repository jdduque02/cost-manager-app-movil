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
  migrateGuestDataToUser,
  wipeGuestData,
  GUEST_USER_ID,
} from "@/database/local.repository";
import type { LoginDto } from "@/types/auth.types";
import type { UserResponse } from "@/types/user.types";

// Persiste que la sesión activa es "modo invitado" para poder restaurarla al
// reabrir la app (initialize()) sin depender de un usuario cacheado real.
const GUEST_MODE_KEY = "guest_mode_active_v1";

/**
 * Usuario sintético para el modo invitado: no viene del backend (no hay
 * sesión real), solo sirve para que las pantallas que muestran `user.*`
 * (perfil, saludo del dashboard) tengan algo coherente que renderizar.
 */
function buildGuestUser(): UserResponse {
  const nowIso = new Date().toISOString();
  return {
    id: GUEST_USER_ID,
    username: "invitado",
    email: "",
    full_name: "Invitado",
    is_active: true,
    created_at: nowIso,
    updated_at: null,
  };
}

interface AuthState {
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  isGuest: boolean;
  isLoading: boolean;
  user: UserResponse | null;
  userId: number | null;
  error: string | null;

  initialize: () => Promise<void>;
  login: (dto: LoginDto) => Promise<void>;
  loginOffline: () => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
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
  isGuest: false,
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
          isGuest: false,
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
          isGuest: false,
          user: cachedUser,
          userId: cachedUser.id,
          isLoading: false,
        });
        return;
      }

      // 3. Sin token ni usuario cacheado: restaurar modo invitado si la
      // última sesión activa era una (nunca inició sesión, pero ya venía
      // usando la app localmente).
      const wasGuest = await SecureStore.getItemAsync(GUEST_MODE_KEY);
      if (wasGuest === "1") {
        set({
          isAuthenticated: true,
          isOfflineMode: false,
          isGuest: true,
          user: buildGuestUser(),
          userId: GUEST_USER_ID,
          isLoading: false,
        });
        return;
      }

      set({
        isAuthenticated: false,
        isOfflineMode: false,
        isGuest: false,
        isLoading: false,
      });
    } catch {
      // Si falla todo, intentar modo offline con caché
      try {
        const cachedUser = await getCachedUser();
        if (cachedUser) {
          set({
            isAuthenticated: true,
            isOfflineMode: true,
            isGuest: false,
            user: cachedUser,
            userId: cachedUser.id,
            isLoading: false,
          });
          return;
        }
      } catch {
        // ignorar
      }
      set({
        isAuthenticated: false,
        isOfflineMode: false,
        isGuest: false,
        isLoading: false,
      });
    }
  },

  login: async (dto: LoginDto) => {
    set({ isLoading: true, error: null });
    const wasGuest = get().isGuest;
    try {
      const tokenData = await authApi.login(dto);

      const userId = tokenData.userId;

      set({
        isAuthenticated: true,
        isOfflineMode: false,
        isGuest: false,
        isLoading: false,
        userId: userId ?? null,
      });

      // Si veníamos de modo invitado, reasignar los datos locales creados sin
      // cuenta (user_id = GUEST_USER_ID) al usuario real recién logueado.
      // Solo se limpia la marca de invitado si la migración corrió y no
      // lanzó: si falla, o si el login no trajo un userId utilizable, se deja
      // la marca activa para reintentar en el próximo login exitoso en vez de
      // perder silenciosamente el rastro de esos datos.
      if (wasGuest) {
        if (userId) {
          try {
            await migrateGuestDataToUser(userId);
            await SecureStore.deleteItemAsync(GUEST_MODE_KEY);
          } catch {
            // No bloquear el login por esto.
          }
        }
      } else {
        await SecureStore.deleteItemAsync(GUEST_MODE_KEY);
      }

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
      console.error(
        "[Auth] login failed:",
        isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message ??
              err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
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
        isGuest: false,
        user: cachedUser,
        userId: cachedUser.id,
        error: null,
      });
      return true;
    }
    return false;
  },

  // Modo invitado: entra a la app sin cuenta ni red, usando datos 100%
  // locales bajo GUEST_USER_ID. Se persiste en SecureStore para sobrevivir a
  // un reinicio de la app (ver paso 3 de `initialize`). Si el usuario ya
  // tenía una sesión real cacheada, se prioriza esa — nunca "downgradea" un
  // usuario real conocido a invitado.
  continueAsGuest: async () => {
    const cachedUser = await getCachedUser();
    if (cachedUser) {
      set({
        isAuthenticated: true,
        isOfflineMode: true,
        isGuest: false,
        user: cachedUser,
        userId: cachedUser.id,
        error: null,
      });
      return;
    }
    await SecureStore.setItemAsync(GUEST_MODE_KEY, "1");
    set({
      isAuthenticated: true,
      isOfflineMode: false,
      isGuest: true,
      user: buildGuestUser(),
      userId: GUEST_USER_ID,
      error: null,
    });
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // Un invitado que sale nunca debe dejar sus datos locales (user_id = -1)
      // huérfanos para el siguiente usuario/guest del dispositivo.
      await wipeGuestData();
    } catch {
      // Es inofensivo si el wipe falla: no bloquear el logout por esto.
    }
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
      await SecureStore.deleteItemAsync(GUEST_MODE_KEY);
      set({
        isAuthenticated: false,
        isOfflineMode: false,
        isGuest: false,
        user: null,
        userId: null,
        isLoading: false,
      });
    }
  },

  // Como logout(), pero sin llamar al endpoint (el servidor ya rechazó el
  // token) y dejando un mensaje explicando por qué se salió de la sesión.
  handleSessionExpired: async () => {
    try {
      await wipeGuestData();
    } catch {
      // No bloquear la limpieza de sesión si el wipe falla.
    }
    await clearTokens();
    await clearCachedUser();
    await SecureStore.deleteItemAsync(GUEST_MODE_KEY);
    set({
      isAuthenticated: false,
      isOfflineMode: false,
      isGuest: false,
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
