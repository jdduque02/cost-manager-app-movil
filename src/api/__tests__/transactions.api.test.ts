/**
 * getTransactionSummary: el API manda el resumen como `data: [summary]` y el
 * interceptor deja el arreglo — leer `.totals` sobre él dejaba Reportes e
 * Inteligencia en $0.
 */
import { getTransactionSummary } from "../transactions.api";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  apiClient: { get: jest.fn() },
  unwrapList: jest.requireActual("../client").unwrapList,
}));

const mockGet = apiClient.get as jest.Mock;
const query = { date_from: "2026-09-01", date_to: "2026-09-30", group_by: "month" as const };

beforeEach(() => jest.clearAllMocks());

describe("getTransactionSummary", () => {
  it("toma data[0] y convierte montos string (numeric de Postgres) a número", async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        {
          group_by: "month",
          totals: { income: "1500000", expenses: "320000.50", investments: null, count: "7" },
          series: [{ key: "2026-09", label: "sep 2026", income: "1500000", expenses: "320000.50" }],
          by_category: [{ category_id: 3, expenses: "120000" }],
        },
      ],
    });

    const s = await getTransactionSummary(9, query);

    expect(mockGet).toHaveBeenCalledWith("/users/9/transactions/summary", { params: query });
    expect(s.totals).toEqual({ income: 1500000, expenses: 320000.5, investments: 0, count: 7 });
    expect(s.series[0]).toMatchObject({ key: "2026-09", income: 1500000, count: 0 });
    expect(s.by_category[0]).toMatchObject({ category_id: 3, expenses: 120000, income: 0 });
  });

  it("acepta el objeto sin envolver y respuestas vacías sin romper", async () => {
    mockGet.mockResolvedValueOnce({ data: { totals: { income: 10 } } });
    expect((await getTransactionSummary(9, query)).totals.income).toBe(10);

    mockGet.mockResolvedValueOnce({ data: [] });
    const empty = await getTransactionSummary(9, query);
    expect(empty.totals).toEqual({ income: 0, expenses: 0, investments: 0, count: 0 });
    expect(empty.series).toEqual([]);
  });
});
