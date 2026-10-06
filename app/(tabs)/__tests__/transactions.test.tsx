/**
 * Conversión COP↔USD en app/(tabs)/transactions.tsx: el formulario hereda la
 * moneda del producto elegido (editable) y avisa si habrá conversión (R7.1–R7.3).
 * Mockea `useOfflineQuery` por queryKey, sin red ni SQLite.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionsScreen from "../transactions";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type { BankAccountResponse } from "@/types/banking.types";

jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/hooks/useOfflineMutations", () => ({ useOfflineMutations: jest.fn() }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: jest.fn() }));
jest.mock("@/store/offline.store", () => ({ useOfflineStore: jest.fn() }));
// El swipe de la fila usa useEvent de Reanimated, que el mock de Jest no trae.
jest.mock("react-native-gesture-handler", () => ({
  ...jest.requireActual("react-native-gesture-handler"),
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseOfflineQuery = useOfflineQuery as jest.Mock;

const USD_ACCOUNT: BankAccountResponse = {
  id: 3,
  user_id: 5,
  bank_name: "Global66",
  account_type: "ahorros",
  masked_account_number: "****9999",
  display_balance: "120",
  currency: "USD",
  is_primary: false,
  created_at: "2026-01-01",
  updated_at: null,
};

function tx(overrides: Partial<TransactionRecordResponse> = {}): TransactionRecordResponse {
  return {
    id: 1,
    user_id: 5,
    category_id: 1,
    type: "expense",
    amount: 400000,
    currency: "COP",
    is_fixed: false,
    description: "Mercado",
    transaction_date: "2026-10-03",
    created_at: "2026-10-03T12:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

function renderScreen(transactions: TransactionRecordResponse[] = []) {
  const byKey: Record<string, unknown> = {
    transactions: { data: transactions, total: transactions.length },
    "bank-accounts": [USD_ACCOUNT],
  };
  mockUseOfflineQuery.mockImplementation((opts: { queryKey: unknown[] }) => ({
    data: byKey[opts.queryKey[0] as string] ?? [],
    isLoading: false,
    refetch: jest.fn(),
    isUsingFallback: false,
    isNetworkBlocked: false,
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TransactionsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useOfflineMutations as jest.Mock).mockReturnValue({});
  (useAuthStore as unknown as jest.Mock).mockImplementation((sel: (s: object) => unknown) =>
    sel({ userId: 5 }),
  );
  (useOfflineStore as unknown as jest.Mock).mockImplementation((sel: (s: object) => unknown) =>
    sel({ isOnline: true }),
  );
});

describe("TransactionsScreen — moneda heredada del producto (R7.1–R7.3)", () => {
  const NOTICE = "Se registrará en USD con la TRM oficial de la fecha";

  it("al elegir una cuenta USD la moneda pasa a USD; cambiarla a COP muestra el aviso", () => {
    renderScreen();
    fireEvent.press(screen.getByText("Nueva"));

    expect(screen.getByRole("button", { name: "COP", selected: true })).toBeTruthy();

    fireEvent.press(screen.getByText("Global66 ****9999 · USD"));
    expect(screen.getByRole("button", { name: "USD", selected: true })).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "COP" }));
    expect(screen.getByRole("button", { name: "COP", selected: true })).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("con un monto ya escrito, elegir la cuenta USD no cambia la moneda y avisa", () => {
    renderScreen();
    fireEvent.press(screen.getByText("Nueva"));
    fireEvent(screen.UNSAFE_getByProps({ label: "Monto" }), "changeValue", "200000");

    fireEvent.press(screen.getByText("Global66 ****9999 · USD"));
    expect(screen.getByRole("button", { name: "COP", selected: true })).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});

describe("TransactionsScreen — fila con su moneda y convertido (R7.4, R7.5)", () => {
  it("formatea cada monto en su moneda y solo la convertida lleva segunda línea", () => {
    renderScreen([
      tx({ id: 1, applied_amount: 97.56, fx_rate: 4100.25 }),
      tx({ id: 2, description: "Netflix", amount: 15.99, currency: "USD" }),
    ]);

    expect(screen.getByText(/US\$\s?15,99/)).toBeTruthy();
    expect(
      screen.getByText(/≈ US\$\s?97,56 · TRM 4\.100,25 \(aprox\.; tu banco puede usar otra tasa\)/),
    ).toBeTruthy();
    expect(screen.getAllByText(/^≈/)).toHaveLength(1);
  });
});
