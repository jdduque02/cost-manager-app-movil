import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_BASE_URL: string =
  Constants.expoConfig?.extra?.API_BASE_URL ?? "http://localhost:3000/api/v1";

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

// Campos que nunca deben aparecer en logs ni ser inspeccionados por interceptores
const SENSITIVE_FIELDS = ["password", "access_token", "refresh_token", "token"];

/** Genera un ID único de request para correlacionar logs sin exponer datos sensibles. */
function generateRequestId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
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
 * Instancia central de Axios para todas las peticiones a la API.
 * - Añade automáticamente el token Bearer via interceptor de request.
 * - Reintenta la petición original tras renovar el token si recibe 401.
 * - Timeout de 15 segundos para evitar peticiones colgadas.
 */
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

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          await clearTokens();
          throw error;
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefresh } =
          response.data.data[0];
        await saveTokens(access_token, newRefresh);

        originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch {
        await clearTokens();
        throw error;
      }
    }

    throw error;
  },
);

/**
 * Persiste los tokens JWT en el almacenamiento seguro del dispositivo (SecureStore).
 * @param accessToken  Token de acceso de corta duración.
 * @param refreshToken Token de refresco de larga duración.
 */
export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Elimina los tokens del almacenamiento seguro (cierre de sesión / expiración).
 */
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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
