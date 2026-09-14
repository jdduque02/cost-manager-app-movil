/**
 * Tests unitarios para `migrateGuestDataToUser` (modo invitado sin login,
 * ver memory/guest-mode-decision.md). Sigue el patrón de mocking de
 * local.repository.companies.test.ts: mockea `getDatabase`, no SQLite real.
 */
import {
  migrateGuestDataToUser,
  wipeGuestData,
  GUEST_USER_ID,
} from "../local.repository";
import { getDatabase } from "../database.service";

jest.mock("../database.service", () => ({
  getDatabase: jest.fn(),
}));

const mockGetDatabase = getDatabase as jest.Mock;

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetAllAsync = jest.fn();
const mockWithTransactionAsync = jest.fn((task: () => Promise<void>) => task());

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllAsync.mockResolvedValue([]);
  mockGetDatabase.mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    withTransactionAsync: mockWithTransactionAsync,
  });
});

describe("migrateGuestDataToUser", () => {
  it("reasigna user_id = GUEST_USER_ID a userId real en todas las tablas de datos de invitado", async () => {
    await migrateGuestDataToUser(42);

    const tables = [
      "transactions",
      "bank_accounts",
      "financial_objectives",
      "companies",
      "financial_assets",
      "financial_liabilities",
      "subcategories",
      "objective_payments",
    ];
    for (const table of tables) {
      expect(mockRunAsync).toHaveBeenCalledWith(
        `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
        [42, GUEST_USER_ID],
      );
    }
  });

  it("remapea el userId dentro del payload JSON de pending_operations que pertenecían al invitado", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      { id: 1, payload: JSON.stringify({ userId: GUEST_USER_ID, name: "Café" }) },
      { id: 2, payload: JSON.stringify({ userId: 99, name: "Otra" }) },
    ]);

    await migrateGuestDataToUser(42);

    const updateCall = mockRunAsync.mock.calls.find(
      ([sql]) => sql === "UPDATE pending_operations SET payload = ? WHERE id = ?",
    );
    expect(updateCall).toBeDefined();
    const [, params] = updateCall!;
    expect(JSON.parse(params[0])).toEqual({ userId: 42, name: "Café" });
    expect(params[1]).toBe(1);

    // La operación pendiente que no era del invitado (userId: 99) no se toca.
    const untouchedCall = mockRunAsync.mock.calls.find(
      ([sql, params]) =>
        sql === "UPDATE pending_operations SET payload = ? WHERE id = ?" &&
        params[1] === 2,
    );
    expect(untouchedCall).toBeUndefined();
  });

  it("no ejecuta ningún UPDATE si el nuevo userId no es un entero positivo", async () => {
    await migrateGuestDataToUser(GUEST_USER_ID);
    await migrateGuestDataToUser(0);
    await migrateGuestDataToUser(Number.NaN);

    expect(mockRunAsync).not.toHaveBeenCalled();
    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it("ignora filas de pending_operations con payload JSON corrupto sin lanzar", async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ id: 1, payload: "{not json" }]);

    await expect(migrateGuestDataToUser(42)).resolves.toBeUndefined();
  });
});

describe("wipeGuestData", () => {
  it("borra las filas del invitado en todas las tablas de datos", async () => {
    await wipeGuestData();

    const tables = [
      "transactions",
      "bank_accounts",
      "financial_objectives",
      "companies",
      "financial_assets",
      "financial_liabilities",
      "subcategories",
      "objective_payments",
    ];
    for (const table of tables) {
      expect(mockRunAsync).toHaveBeenCalledWith(
        `DELETE FROM ${table} WHERE user_id = ?`,
        [GUEST_USER_ID],
      );
    }
  });

  it("borra las operaciones pendientes cuyo payload pertenece al invitado y deja las demás", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      { id: 1, payload: JSON.stringify({ userId: GUEST_USER_ID, name: "Café" }) },
      { id: 2, payload: JSON.stringify({ userId: 99, name: "Otra" }) },
    ]);

    await wipeGuestData();

    const deletes = mockRunAsync.mock.calls.filter(([sql]) =>
      sql.includes("DELETE FROM pending_operations"),
    );
    expect(deletes).toEqual([["DELETE FROM pending_operations WHERE id = ?", [1]]]);
  });

  it("no toca pending_operations con payload JSON corrupto", async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ id: 1, payload: "{not json" }]);

    await expect(wipeGuestData()).resolves.toBeUndefined();
    const deletes = mockRunAsync.mock.calls.filter(([sql]) =>
      sql.includes("DELETE FROM pending_operations"),
    );
    expect(deletes).toEqual([]);
  });
});
