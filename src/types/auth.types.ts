export interface LoginDto {
  username: string;
  password: string;
}

export interface RefreshTokenDto {
  refresh_token: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  session_state: string;
  scope: string;
  userId: number;
}
