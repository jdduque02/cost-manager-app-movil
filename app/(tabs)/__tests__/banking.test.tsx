/**
 * Patrimonio neto consolidado en COP en app/(tabs)/banking.tsx (R6.1–R6.4):
 * con TRM, total y nota; sin TRM (móvil sin conexión que nunca la obtuvo),
 * solo el desglose por moneda. La pantalla no muestra totales de activos ni
 * de pasivos aparte (R6.9 no aplica).
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import BankingScreen from "../banking";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";

jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/hooks/useOfflineMutations", () => ({ useOfflineMutations: () => ({}) }));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: { userId: number }) => unknown) => sel({ userId: 5 }),
}));
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: (sel: (s: { isOnline: boolean }) => unknown) => sel({ isOnline: false }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

const TRM = { value: 4000, valid_from: "2026-10-03", valid_to: "2026-10-06", source: "datos.gov.co" };

function renderWith(trm: typeof TRM | null) {
  const byKey: Record<string, unknown> = {
    "bank-accounts": [
      { id: 1, bank_name: "Bancolombia", masked_account_number: "****1", account_type: "ahorros", display_balance: "1000000", currency: "COP" },
      { id: 2, bank_name: "Global66", masked_account_number: "****2", account_type: "ahorros", display_balance: "100", currency: "USD" },
    ],
    "financial-assets": [],
    "financial-liabilities": [
      { id: 9, name: "Tarjeta", liability_type: "tarjeta_credito", current_balance: "200000", currency: "COP" },
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
  return render(<BankingScreen />);
}

it("con TRM: patrimonio = COP + USD×TRM − pasivos, con desglose y fecha de la TRM", () => {
  renderWith(TRM);
  expect(screen.getByText(/^\$\s?1\.200\.000$/)).toBeTruthy();
  expect(screen.getByText(/^\$\s?800\.000 · US\$\s?100,00 · USD a TRM del 3 .*oct/)).toBeTruthy();
});

it("sin ninguna TRM guardada: solo el desglose por moneda, sin total ni nota", () => {
  renderWith(null);
  expect(screen.getByText(/^\$\s?800\.000 · US\$\s?100,00$/)).toBeTruthy();
  expect(screen.queryByText(/TRM/)).toBeNull();
});
