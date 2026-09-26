import axios, {
  isAxiosError,
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

// Hard-block de HTTP en release: tokens y credenciales viajarían en claro.
// El guard de NODE_ENV va primero para que los tests (jest) nunca lleguen a
// evaluar `__DEV__` aquí (babel-preset-expo no lo inlinea en test).
if (
  process.env.NODE_ENV !== "test" &&
  !__DEV__ &&
  !API_BASE_URL.startsWith("https://")
) {
  throw new Error(
    "[Security] API_BASE_URL debe usar HTTPS fuera de desarrollo. Reconfigura .env antes de compilar release.",
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

/**
 * - network: sin respuesta (DNS, TLS, timeout, conexión rechazada).
 * - blocked: 403 cuyo cuerpo no es JSON del API → lo cortó Cloud Armor
 *   (allowlist de IPs) antes de llegar al backend.
 * - client: resto de 4xx (el API rechazó la petición; reintentar no sirve).
 * - server: 5xx, 408 y 429 (transitorios).
 */
export type ApiErrorKind = "network" | "blocked" | "client" | "server";

export const BLOCKED_NETWORK_MESSAGE =
  "Red no autorizada: el servidor de Sprig no acepta conexiones desde esta red. Prueba con otra red.";

/** Todo cuerpo JSON del API (éxito o error del HttpExceptionFilter) trae `timestamp`. */
function isApiJsonBody(body: unknown): boolean {
  return body !== null && typeof body === "object" && "timestamp" in body;
}

/** `null` si no es un error HTTP de axios (p. ej. SessionExpiredError o un bug local). */
export function classifyApiError(err: unknown): ApiErrorKind | null {
  if (!isAxiosError(err)) return null;
  const res = err.response;
  if (!res) return "network";
  // 408/429 son transitorios: reintentar más tarde sí puede salir bien.
  if (res.status >= 500 || res.status === 408 || res.status === 429) return "server";
  if (res.status === 403 && !isApiJsonBody(res.data)) return "blocked";
  return "client";
}

/** Solo lo que puede salir bien más tarde va a la cola offline: red y 5xx. */
export function isQueueableError(err: unknown): boolean {
  const kind = classifyApiError(err);
  return kind === "network" || kind === "server";
}

// El API a veces manda la clave i18n sin traducir ("auth.CREDENTIALS_INVALID")
// o `message: ""` (validación): ninguna de las dos sirve al usuario.
const UNTRANSLATED_I18N_KEY = /^[a-z_]+\.[A-Z0-9_]+$/;

/** Mensaje para el usuario: bloqueo de red, `message` del API o `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (classifyApiError(err) === "blocked") return BLOCKED_NETWORK_MESSAGE;
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: unknown } | undefined)?.message;
    return typeof message === "string" && message && !UNTRANSLATED_I18N_KEY.test(message)
      ? message
      : fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

// Evita emitir el evento de sesión expirada más de una vez cuando varias
// peticiones en paralelo reciben 401 casi simultáneamente.
let sessionExpiredEmitted = false;

// Single-flight del refresh de tokens: cuando N peticiones en paralelo
// reciben 401 casi al mismo tiempo, todas esperan la MISMA promesa de
// POST /auth/refresh en vez de disparar N refreshes con el mismo
// refresh_token — con rotación de tokens, el primer refresh invalida el
// token que los demás iban a usar y el resto de la sesión sana se corta.
let refreshPromise: Promise<string> | null = null;

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

/**
 * Renueva el access_token reutilizando (o creando) la petición de refresh en
 * curso. Devuelve el nuevo access_token; al fallar SIEMPRE rechaza. Quien
 * llama decide qué hacer con el fallo: el 401 reactivo limpia tokens y emite
 * `sessionExpired`; el refresh proactivo solo espera/ignora.
 */
function getAccessTokenAfterRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new SessionExpiredError();

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
    return access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function proactiveRefresh(): Promise<void> {
  try {
    // Comparte el mutex single-flight: si ya hay un POST /auth/refresh en
    // curso (reactivo), se espera en vez de duplicarlo con el mismo token.
    await getAccessTokenAfterRefresh();
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

    // Los endpoints de auth (login/refresh) nunca tienen una "sesión"
    // que pueda expirar todavía — un 401 ahí es credenciales inválidas (o un
    // refresh cuyo token ya rotó), no expiración. Dejar pasar el error tal
    // cual. Excluir /auth/refresh evita que auth.api.refresh() (que sí pasa
    // por apiClient) re-entre al interceptor y recursione.
    const url: string = originalRequest?.url ?? "";
    const isAuthEndpoint =
      url.includes("/auth/login") || url.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const accessToken = await getAccessTokenAfterRefresh();
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // El refresh compartido ya rechazó: N requests 401 en paralelo caen
        // acá, pero clearTokens + emitSessionExpired corren una sola vez
        // (guard por sessionExpiredEmitted).
        if (!sessionExpiredEmitted) {
          sessionExpiredEmitted = true;
          await clearTokens();
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
