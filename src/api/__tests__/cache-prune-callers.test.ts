/**
 * Solo un fetch COMPLETO con una lista verificada poda el caché: el snapshot se
 * toma antes del GET y con el mismo alcance que el filtro (subcategorías por
 * categoría); una respuesta con forma inesperada nunca poda.
 */
import { apiClient } from "../client";
import * as localRepo from "@/database/local.repository";
import { getSubcategories, getCategories } from "../catalog.api";
import { getBankAccounts } from "../banking.api";
import { getEmpresas } from "../empresas.api";

jest.mock("../client", () => ({
  apiClient: { get: jest.fn() },
  unwrapList: jest.requireActual("../client").unwrapList,
  isListPayload: jest.requireActual("../client").isListPayload,
}));
jest.mock("@/database/local.repository", () => ({
  getCachedIds: jest.fn().mockResolvedValue([1, 2]),
  saveSubcategories: jest.fn().mockResolvedValue(undefined),
  saveCategories: jest.fn().mockResolvedValue(undefined),
  saveBankAccounts: jest.fn().mockResolvedValue(undefined),
  saveCompanies: jest.fn().mockResolvedValue(undefined),
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ data: [{ id: 1 }] });
});

it("subcategorías: el snapshot usa el mismo filtro de categoría que el GET", async () => {
  await getSubcategories(7, 3);
  expect(localRepo.getCachedIds).toHaveBeenLastCalledWith("subcategories", 7, 3);
  expect(localRepo.saveSubcategories).toHaveBeenLastCalledWith([{ id: 1 }], [1, 2]);
});

it("cuentas y empresas podan con su snapshot; categorías nunca se podan", async () => {
  await getCategories();
  await getBankAccounts(7);
  await getEmpresas(7);
  expect(localRepo.saveCategories).toHaveBeenCalledWith([{ id: 1 }]);
  expect(localRepo.saveBankAccounts).toHaveBeenCalledWith([{ id: 1 }], [1, 2]);
  expect(localRepo.saveCompanies).toHaveBeenCalledWith([{ id: 1 }], [1, 2]);
});

it("una respuesta que no es lista (unwrapList → []) no poda", async () => {
  mockGet.mockResolvedValueOnce({ data: "" });
  await getBankAccounts(7);
  expect(localRepo.saveBankAccounts).toHaveBeenCalledWith([], undefined);
});
