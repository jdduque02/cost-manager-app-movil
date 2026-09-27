/**
 * Reportes nunca suma entre monedas: el resumen del servidor se pide por
 * moneda (la caché distingue COP/USD en la queryKey), los totales en USD van
 * aparte y el fallback offline agrega solo las transacciones de esa moneda.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import ReportsScreen, { buildLocalSummary } from "../ReportsScreen";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAuthStore } from "@/store/auth.store";
import { getLocalTransactions } from "@/database/local.repository";
import { formatCurrency } from "@/utils/format";

jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: jest.fn() }));
jest.mock("@/database/local.repository", () => ({ getLocalTransactions: jest.fn() }));
jest.mock("@/api/transactions.api", () => ({}));
jest.mock("@/components/charts/TrendAreaChart", () => ({ TrendAreaChart: () => null }));

const mockUseOfflineQuery = useOfflineQuery as jest.Mock;
const totals = (income: number, expenses: number, count: number) => ({
  group_by: "month",
  totals: { income, expenses, investments: 0, count },
  series: [],
});

function setup(usd: ReturnType<typeof totals>) {
  const keys: unknown[][] = [];
  mockUseOfflineQuery.mockImplementation((options: { queryKey: unknown[] }) => {
    keys.push(options.queryKey);
    if (options.queryKey[0] === "reports-transactions") return { data: { data: [] }, isLoading: false };
    return { data: options.queryKey.includes("USD") ? usd : totals(1000000, 400000, 3), isLoading: false };
  });
  render(<ReportsScreen />);
  return keys;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockImplementation((sel: (s: { userId: number }) => unknown) =>
    sel({ userId: 7 }),
  );
});

it("pide el resumen por moneda y muestra USD aparte, sin sumarlo a COP", () => {
  const keys = setup(totals(1200, 200, 2));

  const summaryKeys = keys.filter((k) => k[0] === "reports-summary");
  expect(summaryKeys.some((k) => k.includes("COP"))).toBe(true);
  expect(summaryKeys.some((k) => k.includes("USD"))).toBe(true);
  expect(screen.getByText("En dólares (USD)")).toBeTruthy();
  expect(screen.getByText(formatCurrency(1200, "USD"))).toBeTruthy();
  expect(screen.getByText(formatCurrency(1000, "USD"))).toBeTruthy();
  expect(screen.getByText(formatCurrency(1000000))).toBeTruthy();
});

it("sin movimientos en USD no muestra el bloque de dólares", () => {
  setup(totals(0, 0, 0));
  expect(screen.queryByText("En dólares (USD)")).toBeNull();
});

it("el fallback offline agrega solo las transacciones de la moneda pedida", async () => {
  (getLocalTransactions as jest.Mock).mockResolvedValue([
    { type: "income", amount: 500000, currency: "COP", transaction_date: "2026-09-10" },
    { type: "income", amount: 100, currency: "USD", transaction_date: "2026-09-11" },
    { type: "expense", amount: 30, currency: "USD", transaction_date: "2026-09-12" },
  ]);
  const range = { date_from: "2026-09-01", date_to: "2026-09-30" };

  const usd = await buildLocalSummary(7, range, "month", "USD");
  const cop = await buildLocalSummary(7, range, "month", "COP");

  expect(usd.totals).toEqual({ income: 100, expenses: 30, investments: 0, count: 2 });
  expect(cop.totals).toEqual({ income: 500000, expenses: 0, investments: 0, count: 1 });
});
