import { apiClient, saveTokens, clearTokens } from "./client";
import type {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  KeycloakTokenResponse,
  ApiResponse,
} from "@/types/auth.types";

/**
 * Autentica al usuario contra el servidor Keycloak vía la API.
 * Persiste los tokens en SecureStore al tener éxito.
 * @param dto Credenciales del usuario (username + password).
 * @returns Respuesta completa incluyendo los tokens de Keycloak.
 * @throws AxiosError si las credenciales son inválidas o hay error de red.
 */
export async function login(
  dto: LoginDto,
): Promise<ApiResponse<KeycloakTokenResponse[]>> {
  const { data } = await apiClient.post<ApiResponse<KeycloakTokenResponse[]>>(
    "/auth/login",
    dto,
  );

  const token = data.data[0];
  await saveTokens(token.access_token, token.refresh_token);

  return data;
}

/**
 * Renueva el access_token usando el refresh_token.
 * Actualiza automáticamente los tokens en SecureStore.
 * @param dto Objeto con el refresh_token vigente.
 */
export async function refresh(dto: RefreshTokenDto): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<KeycloakTokenResponse[]>>(
    "/auth/refresh",
    dto,
  );
  const token = data.data[0];
  await saveTokens(token.access_token, token.refresh_token);
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
