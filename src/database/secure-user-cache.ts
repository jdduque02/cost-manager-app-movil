/**
 * Caché local ENCRIPTADA del último perfil de usuario conocido.
 *
 * Por qué existe: el modo offline (`useAuthStore.initialize` / `loginOffline`)
 * necesita saber "quién es el usuario" sin red, para poder mostrarle su propio
 * dashboard sin pedirle credenciales de nuevo. Antes de este módulo esos datos
 * (username, email, nombre completo — PII) se guardaban en texto plano en la
 * tabla `local_user` de SQLite (ver `database.service.ts`, ahora eliminada).
 * SQLite en Expo no cifra su archivo por defecto (no hay SQLCipher instalado
 * en este proyecto), así que cualquier PII ahí queda legible por quien tenga
 * acceso al filesystem del dispositivo (device rooteado/jailbreak, backup sin
 * cifrar, etc.).
 *
 * Este módulo usa `expo-secure-store` (Keychain en iOS, Keystore respaldado
 * por EncryptedSharedPreferences en Android) — el mismo mecanismo que ya usa
 * este repo para tokens (`api/client.ts`) y el rate-limiter de login
 * (`utils/security.ts`) — para no introducir una segunda librería de cifrado.
 * El perfil de usuario es pequeño (unos pocos campos de texto), así que cabe
 * cómodamente dentro de los límites recomendados de SecureStore.
 */
import * as SecureStore from "expo-secure-store";
import type { UserResponse } from "@/types/user.types";

const CACHED_USER_PROFILE_KEY = "cached_user_profile_v1";

interface CachedUserEnvelope {
  user: UserResponse;
  /** ISO timestamp de cuándo se guardó este snapshot — permite mostrar "datos de hace X" en modo offline. */
  cachedAt: string;
}

/** Guarda (sobreescribiendo) el último perfil de usuario conocido en caché encriptada. */
export async function cacheUserProfileSecurely(user: UserResponse): Promise<void> {
  const envelope: CachedUserEnvelope = { user, cachedAt: new Date().toISOString() };
  await SecureStore.setItemAsync(CACHED_USER_PROFILE_KEY, JSON.stringify(envelope));
}

/** Lee el último perfil de usuario cacheado, o `null` si nunca se cacheó o el JSON está corrupto. */
export async function getSecurelyCachedUserProfile(): Promise<UserResponse | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHED_USER_PROFILE_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CachedUserEnvelope;
    return envelope.user ?? null;
  } catch {
    // JSON corrupto o valor legado en un formato distinto: tratar como "sin caché"
    // en vez de tronar el arranque de la app en modo offline.
    return null;
  }
}

/** Devuelve cuándo se guardó el snapshot cacheado (ISO), o `null` si no hay caché. */
export async function getSecurelyCachedUserProfileTimestamp(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHED_USER_PROFILE_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CachedUserEnvelope;
    return envelope.cachedAt ?? null;
  } catch {
    return null;
  }
}

/** Borra el perfil de usuario cacheado (logout / sesión expirada). */
export async function clearSecurelyCachedUserProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(CACHED_USER_PROFILE_KEY);
}
