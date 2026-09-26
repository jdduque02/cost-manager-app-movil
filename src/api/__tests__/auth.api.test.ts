/**
 * Tests unitarios para src/api/auth.api.ts
 *
 * Mockea el apiClient de Axios y SecureStore para aislar la lógica de la API.
 */

import { login, logout, forgotPassword } from "../auth.api";
import { apiClient, saveTokens, clearTokens } from "../client";

jest.mock("../client", () => ({
  apiClient: {
    post: jest.fn(),
  },
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

const mockPost = apiClient.post as jest.Mock;
const mockSaveTokens = saveTokens as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;

const mockTokenResponse = {
  access_token: "mock-access",
  refresh_token: "mock-refresh",
  expires_in: 3600,
  refresh_expires_in: 86400,
  token_type: "Bearer",
  session_state: "abc",
  scope: "openid",
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("hace un solo POST a /auth/login con la contraseña tal cual (sin /auth/encrypt) y guarda tokens", async () => {
    // apiClient.post ya viene desenvuelto del envelope (lo hace el interceptor real,
    // que este mock del módulo "../client" reemplaza por completo).
    mockPost.mockResolvedValueOnce({ data: [mockTokenResponse] });

    const result = await login({ username: "user", password: "Pass1234" });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      username: "user",
      password: "Pass1234",
    });
    expect(mockPost).not.toHaveBeenCalledWith("/auth/encrypt", expect.anything());
    expect(mockSaveTokens).toHaveBeenCalledWith("mock-access", "mock-refresh", 3600);
    expect(result.access_token).toBe("mock-access");
  });

  it("propaga el error si falla el login", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));
    await expect(
      login({ username: "user", password: "wrong" }),
    ).rejects.toThrow("Network error");
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("hace POST a /auth/logout y limpia tokens", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    await logout("mock-refresh");

    expect(mockPost).toHaveBeenCalledWith("/auth/logout", {
      refresh_token: "mock-refresh",
    });
    expect(mockClearTokens).toHaveBeenCalled();
  });
});

// ─── forgotPassword ───────────────────────────────────────────────────────────

describe("forgotPassword", () => {
  it("hace POST a /auth/forgot-password con el email", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    await forgotPassword({ email: "test@test.com" });

    expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "test@test.com",
    });
  });
});
