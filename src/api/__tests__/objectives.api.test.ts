/**
 * Tests unitarios para src/api/objectives.api.ts
 *
 * Mockea el apiClient de Axios para aislar la lógica de normalización.
 * Foco principal: `normalizeObjective` debe coercionar `target_amount`,
 * `current_balance` y `months_of_expenses_covered` a `number` cuando el
 * backend los devuelve como string (comportamiento real de TypeORM con
 * columnas `numeric`) — este es el bug que ya ocurrió en el frontend web
 * hermano por no coercionar `months_of_expenses_covered`.
 */
import {
  getObjectives,
  getObjective,
  createObjective,
  updateObjective,
} from "../objectives.api";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  unwrapList: jest.requireActual("../client").unwrapList,
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPatch = apiClient.patch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function rawObjective(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 1,
    user_id: 5,
    name: "Fondo de emergencia",
    type: "emergency_fund",
    target_amount: "5000000",
    current_balance: "1250000.50",
    start_date: "2026-01-01",
    end_date: null,
    is_completed: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

// ─── normalizeObjective (vía getObjectives/getObjective/createObjective) ──────

describe("normalizeObjective — months_of_expenses_covered", () => {
  it("coerciona months_of_expenses_covered de string a number (bug prevenido)", async () => {
    mockGet.mockResolvedValueOnce({
      data: [rawObjective({ months_of_expenses_covered: "3.5" })],
    });

    const [result] = await getObjectives(5);

    expect(result.months_of_expenses_covered).toBe(3.5);
    expect(typeof result.months_of_expenses_covered).toBe("number");
  });

  it("deja months_of_expenses_covered en null cuando el backend lo manda null", async () => {
    mockGet.mockResolvedValueOnce({
      data: [rawObjective({ months_of_expenses_covered: null })],
    });

    const [result] = await getObjectives(5);

    expect(result.months_of_expenses_covered).toBeNull();
  });

  it("deja months_of_expenses_covered en null cuando el backend no lo envía (tipo distinto a emergency_fund)", async () => {
    const raw = rawObjective({ type: "savings" });
    delete raw.months_of_expenses_covered;
    mockGet.mockResolvedValueOnce({ data: [raw] });

    const [result] = await getObjectives(5);

    expect(result.months_of_expenses_covered).toBeNull();
    expect(result.type).toBe("savings");
  });

  it("coerciona correctamente en getObjective (item único)", async () => {
    mockGet.mockResolvedValueOnce({
      data: rawObjective({ months_of_expenses_covered: "2" }),
    });

    const result = await getObjective(5, 1);

    expect(result.months_of_expenses_covered).toBe(2);
  });

  it("coerciona correctamente en createObjective", async () => {
    mockPost.mockResolvedValueOnce({
      data: rawObjective({ months_of_expenses_covered: "0" }),
    });

    const result = await createObjective(5, {
      name: "Fondo de emergencia",
      type: "emergency_fund",
    });

    expect(result.months_of_expenses_covered).toBe(0);
  });

  it("coerciona correctamente en updateObjective", async () => {
    mockPatch.mockResolvedValueOnce({
      data: rawObjective({ months_of_expenses_covered: "4.25" }),
    });

    const result = await updateObjective(5, 1, { name: "Renombrado" });

    expect(result.months_of_expenses_covered).toBe(4.25);
  });
});

describe("normalizeObjective — target_amount/current_balance (regresión existente)", () => {
  it("sigue coercionando target_amount y current_balance a number", async () => {
    mockGet.mockResolvedValueOnce({
      data: [rawObjective({ target_amount: "5000000", current_balance: "1250000.50" })],
    });

    const [result] = await getObjectives(5);

    expect(result.target_amount).toBe(5000000);
    expect(result.current_balance).toBe(1250000.5);
  });

  it("deja target_amount en null cuando viene null", async () => {
    mockGet.mockResolvedValueOnce({
      data: [rawObjective({ target_amount: null })],
    });

    const [result] = await getObjectives(5);

    expect(result.target_amount).toBeNull();
  });
});
