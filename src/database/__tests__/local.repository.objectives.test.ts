/**
 * Tests unitarios para las funciones de "objetivos financieros" de
 * src/database/local.repository.ts, con foco en la columna
 * `months_of_expenses_covered` (solo aplica a type=emergency_fund).
 *
 * Sigue el patrón de mocking de local.repository.companies.test.ts: mockea
 * `getDatabase` (no SQLite real) y verifica el SQL/valores con los que se
 * llama.
 */
import {
  saveObjectives,
  getLocalObjectives,
  createLocalObjective,
} from "../local.repository";
import { getDatabase } from "../database.service";
import type { FinancialObjectiveResponse } from "@/types/objective.types";

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
    withTransactionAsync: mockWithTransactionAsync,
  });
});

describe("saveObjectives", () => {
  it("guarda un objetivo emergency_fund con months_of_expenses_covered numérico", async () => {
    const objectives: FinancialObjectiveResponse[] = [
      {
        id: 1,
        user_id: 5,
        name: "Fondo de emergencia",
        type: "emergency_fund",
        target_amount: 5000000,
        current_balance: 1250000,
        start_date: "2026-01-01",
        end_date: null,
        is_completed: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        months_of_expenses_covered: 3.5,
      },
    ];

    await saveObjectives(objectives);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO financial_objectives"),
      [
        1,
        "1",
        5,
        "Fondo de emergencia",
        "emergency_fund",
        5000000,
        1250000,
        "2026-01-01",
        null,
        0,
        "2026-01-01T00:00:00Z",
        null,
        3.5,
      ],
    );
  });

  it("guarda null en months_of_expenses_covered para un objetivo que no es emergency_fund", async () => {
    const objectives: FinancialObjectiveResponse[] = [
      {
        id: 2,
        user_id: 5,
        name: "Ahorro viaje",
        type: "savings",
        target_amount: 2000000,
        current_balance: 0,
        start_date: null,
        end_date: null,
        is_completed: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        months_of_expenses_covered: null,
      },
    ];

    await saveObjectives(objectives);

    const [, params] = mockRunAsync.mock.calls[0];
    expect(params[params.length - 1]).toBeNull();
  });
});

describe("getLocalObjectives", () => {
  it("lee de SQLite un objetivo emergency_fund con months_of_expenses_covered numérico", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 1,
        local_id: "1",
        user_id: 5,
        name: "Fondo de emergencia",
        type: "emergency_fund",
        target_amount: 5000000,
        current_balance: 1250000,
        start_date: "2026-01-01",
        end_date: null,
        is_completed: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        months_of_expenses_covered: 3.5,
      },
    ]);

    const [result] = await getLocalObjectives(5);

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM financial_objectives WHERE user_id = ?",
      [5],
    );
    expect(result.type).toBe("emergency_fund");
    expect(result.months_of_expenses_covered).toBe(3.5);
  });

  it("mapea months_of_expenses_covered a null cuando la columna está vacía", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 2,
        local_id: "2",
        user_id: 5,
        name: "Ahorro viaje",
        type: "savings",
        target_amount: 2000000,
        current_balance: 0,
        start_date: null,
        end_date: null,
        is_completed: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        months_of_expenses_covered: null,
      },
    ]);

    const [result] = await getLocalObjectives(5);

    expect(result.months_of_expenses_covered).toBeNull();
  });
});

describe("createLocalObjective", () => {
  beforeEach(() => {
    mockGetFirstAsync.mockResolvedValue({ id: 99 });
  });

  it("deja months_of_expenses_covered en null: es un valor calculado por el backend, no derivable offline", async () => {
    const result = await createLocalObjective(5, {
      name: "Fondo de emergencia",
      type: "emergency_fund",
      target_amount: 5000000,
    });

    expect(result.months_of_expenses_covered).toBeNull();
    expect(result.type).toBe("emergency_fund");
    expect(result.id).toBe(99);
  });
});
