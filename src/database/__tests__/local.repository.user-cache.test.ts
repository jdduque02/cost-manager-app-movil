/**
 * Tests unitarios para el "puente" de local.repository.ts hacia la caché
 * encriptada del perfil de usuario (secure-user-cache.ts).
 *
 * No toca SQLite: verifica solo que cacheUser/getCachedUser/clearCachedUser
 * delegan en la caché encriptada, para que `useAuthStore` siga funcionando
 * sin cambios tras la migración fuera de la tabla `local_user` en texto plano.
 */
import { cacheUser, getCachedUser, clearCachedUser } from "../local.repository";
import * as secureUserCache from "../secure-user-cache";
import type { UserResponse } from "@/types/user.types";

jest.mock("../secure-user-cache", () => ({
  cacheUserProfileSecurely: jest.fn(),
  getSecurelyCachedUserProfile: jest.fn(),
  clearSecurelyCachedUserProfile: jest.fn(),
}));

const mockCacheSecurely = secureUserCache.cacheUserProfileSecurely as jest.Mock;
const mockGetSecurely = secureUserCache.getSecurelyCachedUserProfile as jest.Mock;
const mockClearSecurely = secureUserCache.clearSecurelyCachedUserProfile as jest.Mock;

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

it("cacheUser delega en la caché encriptada, no en SQLite", async () => {
  await cacheUser(mockUser);
  expect(mockCacheSecurely).toHaveBeenCalledWith(mockUser);
});

it("getCachedUser delega en la caché encriptada, no en SQLite", async () => {
  mockGetSecurely.mockResolvedValueOnce(mockUser);
  const result = await getCachedUser();
  expect(result).toEqual(mockUser);
  expect(mockGetSecurely).toHaveBeenCalled();
});

it("clearCachedUser delega en la caché encriptada, no en SQLite", async () => {
  await clearCachedUser();
  expect(mockClearSecurely).toHaveBeenCalled();
});
