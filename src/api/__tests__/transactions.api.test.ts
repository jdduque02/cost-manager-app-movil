/**
 * getTransactionSummary: el API manda el resumen como `data: [summary]` y el
 * interceptor deja el arreglo — leer `.totals` sobre él dejaba Reportes e
 * Inteligencia en $0.
 */
import { getTransactionSummary, normalizeTransaction } from "../transactions.api";
import type { TransactionRecordResponse } from "@/types/transaction.types";
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

    expect(mockGet).toHaveBeenCalledWith("/users/9/transactions/summary", {
      params: { ...query, currency: "COP" },
    });
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

  it("sin moneda pide COP (el API mezcla monedas si no se indica) y respeta USD", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await getTransactionSummary(9, { date_from: "2026-09-01", date_to: "2026-09-30" });
    expect(mockGet.mock.calls[0][1].params.currency).toBe("COP");

    await getTransactionSummary(9, { ...query, currency: "USD" });
    expect(mockGet.mock.calls[1][1].params.currency).toBe("USD");
  });
});

describe("normalizeTransaction", () => {
  const base = { id: 1, amount: "400000.00", currency: "COP" } as unknown as TransactionRecordResponse;

  it("convierte applied_amount y fx_rate (string de numeric) a número", () => {
    const t = normalizeTransaction({
      ...base,
      applied_amount: "97.56",
      fx_rate: "4100.2500",
    } as unknown as TransactionRecordResponse);
    expect(t).toMatchObject({ amount: 400000, applied_amount: 97.56, fx_rate: 4100.25 });
  });

  it("sin conversión deja applied_amount y fx_rate en null", () => {
    expect(normalizeTransaction({ ...base, applied_amount: null })).toMatchObject({
      applied_amount: null,
      fx_rate: null,
    });
  });
});
