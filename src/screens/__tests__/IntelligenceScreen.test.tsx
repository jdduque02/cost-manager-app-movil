/**
 * El resumen del mes de Inteligencia se pide por moneda: la tasa de ahorro y
 * el presupuesto usan solo COP y los movimientos en USD se muestran aparte.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import IntelligenceScreen from "../IntelligenceScreen";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/utils/format";

jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: jest.fn() }));
jest.mock("@/api/client", () => ({ apiClient: { get: jest.fn() } }));
jest.mock("@/api/transactions.api", () => ({}));
jest.mock("@/api/catalog.api", () => ({}));
jest.mock("@/api/users.api", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseOfflineQuery = useOfflineQuery as jest.Mock;
const summary = (income: number, expenses: number, count: number) => ({
  totals: { income, expenses, investments: 0, count },
  by_category: [],
});

function setup(usd: ReturnType<typeof summary>) {
  const keys: unknown[][] = [];
  mockUseOfflineQuery.mockImplementation((options: { queryKey: unknown[] }) => {
    keys.push(options.queryKey);
    if (options.queryKey[0] !== "intelligence-month-summary") return { data: null, isLoading: false };
    return { data: options.queryKey.includes("USD") ? usd : summary(2000000, 500000, 4), isLoading: false };
  });
  render(<IntelligenceScreen />);
  return keys;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockImplementation((sel: (s: { userId: number }) => unknown) =>
    sel({ userId: 7 }),
  );
});

it("pide COP y USD por separado y muestra los totales en USD aparte", () => {
  const keys = setup(summary(300, 45.5, 2));

  const monthKeys = keys.filter((k) => k[0] === "intelligence-month-summary");
  expect(monthKeys.some((k) => k.includes("COP"))).toBe(true);
  expect(monthKeys.some((k) => k.includes("USD"))).toBe(true);
  expect(screen.getByText(formatCurrency(2000000))).toBeTruthy();
  expect(screen.getByText(formatCurrency(300, "USD"))).toBeTruthy();
  expect(screen.getByText(formatCurrency(45.5, "USD"))).toBeTruthy();
  // La tasa de ahorro sale solo de COP: (2.000.000 - 500.000) / 2.000.000.
  expect(screen.getByText("75.0%")).toBeTruthy();
});

it("sin movimientos en USD no muestra filas en dólares", () => {
  setup(summary(0, 0, 0));
  expect(screen.queryByText("Ingresos (USD)")).toBeNull();
});
