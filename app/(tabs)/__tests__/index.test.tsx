/**
 * Dashboard (app/(tabs)/index.tsx): balance de cuentas consolidado en COP
 * (R6.1–R6.4) e ingresos/gastos del mes solo con movimientos en COP (R6.7).
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import DashboardScreen from "../index";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";

jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: { userId: number }) => unknown) => sel({ userId: 5 }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/charts/TrendAreaChart", () => ({ TrendAreaChart: () => null }));

const TRM = { value: 4000, valid_from: "2026-10-03", valid_to: "2026-10-06", source: "datos.gov.co" };
const today = new Date().toISOString().slice(0, 10);

function renderWith(trm: typeof TRM | null) {
  const transactions = [
    { id: 1, type: "income", amount: 3_000_000, currency: "COP", transaction_date: today, description: "Nómina" },
    { id: 2, type: "income", amount: 500, currency: "USD", transaction_date: today, description: "Freelance" },
    { id: 3, type: "expense", amount: 400_000, currency: "COP", transaction_date: today, description: "Mercado" },
  ];
  const byKey: Record<string, unknown> = {
    transactions: { data: transactions, total: transactions.length },
    "bank-accounts": [
      { id: 1, bank_name: "Bancolombia", masked_account_number: "****1", display_balance: "1000000", currency: "COP" },
      { id: 2, bank_name: "Global66", masked_account_number: "****2", display_balance: "100", currency: "USD" },
    ],
    trm,
  };
  (useOfflineQuery as jest.Mock).mockImplementation((opts: { queryKey: unknown[] }) => ({
    data: byKey[opts.queryKey[0] as string],
    isLoading: false,
    refetch: jest.fn(),
    isUsingFallback: false,
    isNetworkBlocked: false,
  }));
  return render(<DashboardScreen />);
}

it("balance consolidado con TRM e ingresos del mes sin los USD", () => {
  renderWith(TRM);
  expect(screen.getByText(/^\$\s?1\.400\.000$/)).toBeTruthy();
  expect(screen.getByText(/USD a TRM del 3 .*oct/)).toBeTruthy();
  expect(screen.getByText(/^\$\s?3\.000\.000$/)).toBeTruthy();
  expect(screen.getByText(/^\$\s?400\.000$/)).toBeTruthy();
  // La fila reciente del ingreso en USD sale en dólares, no como $500 pesos.
  expect(screen.getByText(/^\+US\$\s?500,00$/)).toBeTruthy();
});

it("sin TRM: el balance es el desglose por moneda", () => {
  renderWith(null);
  expect(screen.getByText(/^\$\s?1\.000\.000 · US\$\s?100,00$/)).toBeTruthy();
  expect(screen.queryByText(/TRM/)).toBeNull();
});
