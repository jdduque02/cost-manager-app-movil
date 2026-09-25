/**
 * Tests unitarios para las funciones de "empresas" agregadas a
 * src/database/local.repository.ts para la creación inline "al vuelo" de una
 * empresa/pagador asociable a una transacción (offline-first: ver
 * memory/share-transaction-decision.md).
 *
 * Sigue el patrón de mocking de local.repository.user-cache.test.ts: mockea
 * `getDatabase` (no SQLite real) y verifica el SQL/valores con los que se
 * llama, y que `createLocalCompany` encole la operación pendiente.
 */
import {
  saveCompanies,
  getLocalCompanies,
  createLocalCompany,
} from "../local.repository";
import { getDatabase } from "../database.service";
import type { EmpresaResponse, CreateEmpresaDto } from "@/types/empresa.types";

jest.mock("../database.service", () => ({
  getDatabase: jest.fn(),
}));

const mockGetDatabase = getDatabase as jest.Mock;

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

const mockWithTransactionAsync = jest.fn((task: () => Promise<void>) => task());

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDatabase.mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    // `saveCompanies` envuelve sus inserts en una sola transacción (ver
    // hallazgo H2.2 de la auditoría de sept/2026) — el mock solo necesita
    // ejecutar el callback tal cual, sin semántica real de transacción.
    withTransactionAsync: mockWithTransactionAsync,
  });
});

describe("saveCompanies", () => {
  it("inserta/reemplaza cada empresa en la tabla local", async () => {
    const companies: EmpresaResponse[] = [
      {
        id: 1,
        user_id: 5,
        name: "Empresa A",
        default_category_id: 2,
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
      },
    ];

    await saveCompanies(companies);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO companies"),
      [1, "1", 5, "Empresa A", 2, "2024-01-01", "2024-01-02"],
    );
  });

  it("no ejecuta ningún insert si la lista está vacía", async () => {
    await saveCompanies([]);
    expect(mockRunAsync).not.toHaveBeenCalled();
  });
});

describe("getLocalCompanies", () => {
  it("filtra por userId y mapea las filas a EmpresaResponse", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 1,
        user_id: 5,
        name: "Empresa A",
        default_category_id: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
      },
    ]);

    const result = await getLocalCompanies(5);

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM companies WHERE user_id = ?",
      [5],
    );
    expect(result).toEqual([
      {
        id: 1,
        user_id: 5,
        name: "Empresa A",
        default_category_id: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
        is_pending_sync: false,
      },
    ]);
  });
});

describe("createLocalCompany", () => {
  const dto: CreateEmpresaDto = { name: "Nueva Empresa", default_category_id: 3 };

  beforeEach(() => {
    mockGetFirstAsync.mockResolvedValue({ id: 42 });
  });

  it("inserta la empresa localmente marcada como pendiente de sincronizar", async () => {
    await createLocalCompany(5, dto);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO companies"),
      expect.arrayContaining([5, "Nueva Empresa", 3]),
    );
    const [, params] = mockRunAsync.mock.calls[0];
    // is_pending_sync = 1 está hardcodeado en el VALUES, no como parámetro.
    expect(mockRunAsync.mock.calls[0][0]).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
    expect(params).toHaveLength(7);
  });

  it("encola una operación CREATE pendiente con el dto y el userId", async () => {
    await createLocalCompany(5, dto);

    const enqueueCall = mockRunAsync.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO pending_operations"),
    );
    expect(enqueueCall).toBeDefined();
    const [, params] = enqueueCall!;
    const payload = JSON.parse(params[3]);
    expect(payload).toMatchObject({ userId: 5, name: "Nueva Empresa", default_category_id: 3 });
    expect(params[1]).toBe("companies");
    expect(params[2]).toBe("CREATE");
  });

  it("retorna la empresa con un id local negativo y default_category_id null si no se envía", async () => {
    const result = await createLocalCompany(5, { name: "Sin categoría" });

    expect(result.id).toBeLessThan(0);
    expect(result).toMatchObject({
      user_id: 5,
      name: "Sin categoría",
      default_category_id: null,
    });
  });
});
