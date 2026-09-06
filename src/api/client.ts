import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";
import { emitSessionExpired } from "@/lib/session-events";

// Permite pedir explícitamente que una respuesta paginada NO se aplane
// (ver unwrapEnvelope) — usado por endpoints de listado con `{ data, total }`.
declare module "axios" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D = any> {
    preservePaginated?: boolean;
  }
}

const API_BASE_URL: string =
  Constants.expoConfig?.extra?.API_BASE_URL ?? "http://localhost:3000/api/v1";

// Log the API URL on startup for debugging network issues
console.log(`[API] Base URL: ${API_BASE_URL}`);

// Advertir si se usa HTTP fuera de localhost en cualquier build
if (
  !API_BASE_URL.startsWith("https://") &&
  !API_BASE_URL.includes("localhost") &&
  !API_BASE_URL.includes("10.0.2.2") && // emulador Android
  !API_BASE_URL.includes("127.0.0.1")
) {
  console.warn(
    "[Security] API_BASE_URL no usa HTTPS. Configura una URL segura en producción.",
  );
}

const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * Sesión expirada de forma irrecuperable: el 401 reactivo probó que el
 * backend rechazó el token, y el refresh también falló (o no había
 * refresh_token). Distinta de un error de red/servidor genérico —
 * `useOfflineQuery` la deja propagarse en vez de esconderla como "sin conexión".
 */
export class SessionExpiredError extends Error {
  constructor(message = "Tu sesión expiró, inicia sesión de nuevo") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(err: unknown): err is SessionExpiredError {
  return err instanceof SessionExpiredError;
}

// Evita emitir el evento de sesión expirada más de una vez cuando varias
// peticiones en paralelo reciben 401 casi simultáneamente.
let sessionExpiredEmitted = false;

// Refresh proactivo: el access token dura ~15 min y el refresh ~1h. En vez de
// esperar a que una petición falle con 401 (lo que el usuario ve como un
// error momentáneo o, peor, como "sin datos"), se programa un refresh ~60s
// antes de que el access token expire.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let tokenExpiresAt: number | null = null;

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  tokenExpiresAt = null;
}

function scheduleProactiveRefresh(expiresInSeconds: number): void {
  clearRefreshTimer();
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  const delayMs = Math.max((expiresInSeconds - 60) * 1000, 5000);
  refreshTimer = setTimeout(() => {
    proactiveRefresh();
  }, delayMs);
}

async function proactiveRefresh(): Promise<void> {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;

    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    const token = unwrapEnvelope<
      { access_token: string; refresh_token: string; expires_in?: number }[]
    >(response.data)[0];
    await saveTokens(token.access_token, token.refresh_token, token.expires_in);
  } catch {
    // Un refresh proactivo que falla (ej. blip de red en background) NO debe
    // forzar logout — sólo el 401 reactivo real (que prueba que el backend
    // rechazó el token) dispara `emitSessionExpired()`. El siguiente request
    // real disparará el flujo reactivo si el token efectivamente ya no sirve.
  }
}

// Al volver la app a primer plano, si el token ya venció (o está por vencer)
// según el timestamp guardado en memoria, refrescar de inmediato en vez de
// esperar a que la primera pantalla truene en 401.
AppState.addEventListener("change", (state: AppStateStatus) => {
  if (state !== "active" || tokenExpiresAt === null) return;
  const remainingMs = tokenExpiresAt - Date.now();
  if (remainingMs < 60_000) {
    proactiveRefresh();
  }
});

// Campos que nunca deben aparecer en logs ni ser inspeccionados por interceptores
const SENSITIVE_FIELDS = ["password", "access_token", "refresh_token", "token"];

/** Genera un ID único de request para correlacionar logs sin exponer datos sensibles. */
function generateRequestId(): string {
  const hex = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 32; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

/** Elimina campos sensibles de un objeto para logging seguro (no modifica el original). */
export function redactSensitive(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f))
        ? [k, "[REDACTED]"]
        : [k, v],
    ),
  );
}

/**
 * El backend envuelve toda respuesta en `{ status, message, data: [...], timestamp }`.
 * Detecta ese envelope para poder desenvolverlo automáticamente.
 */
function isApiResponseEnvelope(json: unknown): json is {
  status: boolean;
  message: string;
  data: unknown[];
  timestamp: string;
} {
  return (
    json !== null &&
    typeof json === "object" &&
    "status" in json &&
    typeof (json as Record<string, unknown>).status === "boolean" &&
    "data" in json &&
    Array.isArray((json as Record<string, unknown>).data)
  );
}

/**
 * Desenvuelve el envelope `{ status, data: [...], timestamp }` del backend.
 * - Lista simple o item único: `data = [item1, ...]` → devuelve el array tal cual
 *   (el caller decide si necesita `[0]`, igual que en el cliente web de referencia).
 * - Lista paginada: el backend (`ApiResponseDto.paginated`) manda el arreglo de
 *   items directo en `data` y el `total` en la RAÍZ del envelope (no anidado
 *   como `data: [{ data: [...], total }]`) → devuelve `items`
 *   (o `{ data, total }` si `preservePaginated` es true).
 */
export function unwrapEnvelope<T>(
  json: Record<string, unknown>,
  preservePaginated = false,
): T {
  const data = json.data as unknown[];

  if (typeof json.total === "number") {
    return (preservePaginated
      ? { data, total: json.total }
      : data) as unknown as T;
  }

  if (data.length === 0) return [] as unknown as T;
  if (data.length === 1) {
    const single = data[0];
    if (
      single !== null &&
      typeof single === "object" &&
      "data" in single &&
      "total" in single &&
      Array.isArray((single as Record<string, unknown>).data)
    ) {
      return (preservePaginated
        ? single
        : (single as Record<string, unknown>).data) as T;
    }
  }
  return data as unknown as T;
}

/**
 * Defensivo contra respuestas de listado que llegan como el envoltorio
 * paginado `{ data: [...], total }` en vez del arreglo desnudo — pasa
 * cuando `isApiResponseEnvelope` no reconoce el nivel superior (su chequeo
 * exige que `data` sea un arreglo ahí mismo) y el paginado queda intacto un
 * nivel más abajo. Usar en cualquier endpoint de listado que no pase
 * `preservePaginated`.
 */
export function unwrapList<T>(
  data: T[] | { data: T[]; total?: number } | null | undefined,
): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { data: T[] }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
}

/**
 * Instancia central de Axios para todas las peticiones a la API.
 * - Añade automáticamente el token Bearer via interceptor de request.
 * - Desenvuelve automáticamente el envelope `{status, data, timestamp}` del backend.
 * - Reintenta la petición original tras renovar el token si recibe 401.
 * - Timeout de 15 segundos para evitar peticiones colgadas.
 */
// eslint-disable-next-line import/no-named-as-default-member -- axios's default export is the real AxiosStatic instance at runtime
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
  // No exponer detalles de la app en el User-Agent por defecto de axios
  withCredentials: false,
});

// Request interceptor: adjuntar Bearer token + X-Request-ID
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    // Identificador único por petición para correlacionar en el servidor
    if (config.headers) {
      config.headers["X-Request-ID"] = generateRequestId();
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: desenvolver el envelope del backend + auto-refresh en 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (isApiResponseEnvelope(response.data)) {
      response.data = unwrapEnvelope(
        response.data,
        Boolean(response.config.preservePaginated),
      );
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Diagnóstico: Axios oculta la causa real de "Network Error" (DNS, TLS,
    // conexión rechazada, timeout). Estos campos ayudan a distinguirlas.
    console.warn("[API] Request failed", {
      url: `${originalRequest?.baseURL ?? ""}${originalRequest?.url ?? ""}`,
      code: error.code,
      message: error.message,
      hasResponse: Boolean(error.response),
      status: error.response?.status,
    });

    // Los endpoints de auth (login/encrypt) nunca tienen una "sesión" que
    // pueda expirar todavía — un 401 ahí es credenciales inválidas, no
    // expiración. Dejar pasar el error tal cual para que login() lo maneje.
    const url: string = originalRequest?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/encrypt");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          await clearTokens();
          if (!sessionExpiredEmitted) {
            sessionExpiredEmitted = true;
            emitSessionExpired();
          }
          throw new SessionExpiredError();
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const {
          access_token,
          refresh_token: newRefresh,
          expires_in,
        } = unwrapEnvelope<
          { access_token: string; refresh_token: string; expires_in?: number }[]
        >(response.data)[0];
        await saveTokens(access_token, newRefresh, expires_in);

        originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        if (isSessionExpiredError(refreshErr)) throw refreshErr;
        await clearTokens();
        if (!sessionExpiredEmitted) {
          sessionExpiredEmitted = true;
          emitSessionExpired();
        }
        throw new SessionExpiredError();
      }
    }

    throw error;
  },
);

/**
 * Persiste los tokens JWT en el almacenamiento seguro del dispositivo (SecureStore).
 * @param accessToken  Token de acceso de corta duración.
 * @param refreshToken Token de refresco de larga duración.
 * @param expiresIn    Segundos de vigencia del access token; si se provee,
 *                      programa un refresh proactivo antes de que expire.
 */
export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn?: number,
): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  sessionExpiredEmitted = false;
  if (expiresIn) scheduleProactiveRefresh(expiresIn);
}

/**
 * Elimina los tokens del almacenamiento seguro (cierre de sesión / expiración).
 */
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  clearRefreshTimer();
}

/**
 * Lee los tokens almacenados sin hacer ninguna petición al servidor.
 * Útil para verificar si el usuario tenía sesión activa al arrancar la app.
 */
export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  return { accessToken, refreshToken };
}
