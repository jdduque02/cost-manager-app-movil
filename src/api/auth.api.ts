import { apiClient, saveTokens, clearTokens, unwrapList } from "./client";
import type {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  KeycloakTokenResponse,
} from "@/types/auth.types";

/**
 * Autentica al usuario contra el servidor Keycloak vía la API.
 * La contraseña viaja tal cual: la protege TLS (client.ts bloquea HTTP en
 * release). El API ya no expone /auth/encrypt.
 * Persiste los tokens en SecureStore al tener éxito.
 */
export async function login(dto: LoginDto): Promise<KeycloakTokenResponse> {
  const { data } = await apiClient.post<KeycloakTokenResponse[]>(
    "/auth/login",
    { username: dto.username, password: dto.password },
  );

  const token = data[0];
  await saveTokens(token.access_token, token.refresh_token, token.expires_in);

  return token;
}

/**
 * Renueva el access_token usando el refresh_token.
 * Actualiza automáticamente los tokens en SecureStore.
 * @param dto Objeto con el refresh_token vigente.
 */
export async function refresh(dto: RefreshTokenDto): Promise<void> {
  const { data } = await apiClient.post<KeycloakTokenResponse[]>(
    "/auth/refresh",
    dto,
  );
  const token = data[0];
  await saveTokens(token.access_token, token.refresh_token, token.expires_in);
}

/**
 * Cierra la sesión del usuario en Keycloak e invalida el refresh_token.
 * Elimina los tokens del almacenamiento seguro local.
 * @param refreshToken Token de refresco activo.
 */
export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken });
  await clearTokens();
}

/**
 * Solicita el flujo de recuperación de contraseña al servidor.
 * El servidor envía un correo con instrucciones al email indicado.
 * @param dto Objeto con el email del usuario registrado.
 */
export async function forgotPassword(dto: ForgotPasswordDto): Promise<void> {
  await apiClient.post("/auth/forgot-password", dto);
}

export interface VerifyOtpResult {
  reset_token: string;
  expires_in_seconds: number;
}

/**
 * Verifica el código OTP de 6 dígitos recibido por correo.
 * Devuelve un reset_token de un solo uso para completar resetPassword().
 * @param email Email del usuario.
 * @param code Código OTP de 6 dígitos.
 */
export async function verifyOtp(
  email: string,
  code: string,
): Promise<VerifyOtpResult> {
  const { data } = await apiClient.post<VerifyOtpResult[]>(
    "/auth/verify-otp",
    { email, code },
  );
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Restablece la contraseña del usuario usando el reset_token de verifyOtp().
 * @param email Email del usuario.
 * @param resetToken Token devuelto por verifyOtp().
 * @param newPassword Nueva contraseña.
 */
export async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post("/auth/reset-password", {
    email,
    reset_token: resetToken,
    new_password: newPassword,
  });
}

/**
 * Cambia la contraseña del usuario autenticado.
 * @param currentPassword Contraseña actual.
 * @param newPassword Nueva contraseña.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post("/auth/change-password", {
    currentPassword,
    newPassword,
  });
}

/**
 * Obtiene la lista de sesiones activas del usuario.
 */
export async function getSessions(): Promise<SessionResponse[]> {
  const { data } = await apiClient.get<SessionResponse[]>("/auth/sessions");
  return unwrapList(data);
}

/**
 * Revoca (cierra) una sesión específica.
 * @param sessionId ID de la sesión a revocar.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`);
}

/**
 * Obtiene el historial de accesos del usuario.
 */
export async function getAccessHistory(): Promise<AccessHistoryEntry[]> {
  const { data } = await apiClient.get<AccessHistoryEntry[]>(
    "/auth/access-history",
  );
  return unwrapList(data);
}

/** `start`/`lastAccess` son epoch en ms serializados como string (Keycloak). */
export interface SessionResponse {
  id: string;
  ipAddress: string;
  browser: string;
  start: string;
  lastAccess: string | null;
}

/** Evento de Keycloak: sin id propio; `time` es epoch en ms como string. */
export interface AccessHistoryEntry {
  type: string;
  ipAddress: string;
  time: string;
  error: string | null;
  details: Record<string, unknown>;
}
