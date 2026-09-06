/**
 * Tests unitarios para src/database/secure-user-cache.ts
 *
 * Mockea expo-secure-store para verificar que el perfil de usuario se
 * guarda/lee/borra vía la caché ENCRIPTADA (no SQLite en texto plano).
 */
import * as SecureStore from "expo-secure-store";
import {
  cacheUserProfileSecurely,
  getSecurelyCachedUserProfile,
  getSecurelyCachedUserProfileTimestamp,
  clearSecurelyCachedUserProfile,
} from "../secure-user-cache";
import type { UserResponse } from "@/types/user.types";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

const CACHE_KEY = "cached_user_profile_v1";

const mockUser: UserResponse = {
  id: 1,
  username: "testuser",
  email: "test@test.com",
  full_name: "Test User",
  is_active: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe("cacheUserProfileSecurely", () => {
  it("guarda el perfil como JSON en SecureStore bajo la clave esperada", async () => {
    await cacheUserProfileSecurely(mockUser);

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    const [key, value] = mockSetItem.mock.calls[0];
    expect(key).toBe(CACHE_KEY);
    const parsed = JSON.parse(value);
    expect(parsed.user).toEqual(mockUser);
    expect(typeof parsed.cachedAt).toBe("string");
  });
});

describe("getSecurelyCachedUserProfile", () => {
  it("retorna el usuario cacheado si existe", async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ user: mockUser, cachedAt: "2024-01-03T00:00:00.000Z" }),
    );

    const result = await getSecurelyCachedUserProfile();

    expect(result).toEqual(mockUser);
    expect(mockGetItem).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("retorna null si no hay nada cacheado", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const result = await getSecurelyCachedUserProfile();

    expect(result).toBeNull();
  });

  it("retorna null (sin tronar) si el valor guardado es JSON corrupto", async () => {
    mockGetItem.mockResolvedValueOnce("{not-valid-json");

    const result = await getSecurelyCachedUserProfile();

    expect(result).toBeNull();
  });
});

describe("getSecurelyCachedUserProfileTimestamp", () => {
  it("retorna el timestamp de cuando se guardó el snapshot", async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ user: mockUser, cachedAt: "2024-01-03T00:00:00.000Z" }),
    );

    const result = await getSecurelyCachedUserProfileTimestamp();

    expect(result).toBe("2024-01-03T00:00:00.000Z");
  });

  it("retorna null si no hay caché", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const result = await getSecurelyCachedUserProfileTimestamp();

    expect(result).toBeNull();
  });
});

describe("clearSecurelyCachedUserProfile", () => {
  it("borra la clave de SecureStore", async () => {
    await clearSecurelyCachedUserProfile();

    expect(mockDeleteItem).toHaveBeenCalledWith(CACHE_KEY);
  });
});
