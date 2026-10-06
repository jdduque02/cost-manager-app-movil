/**
 * Transacciones por validar (R3.3, R3.6, R3.7, R3.14, R8.5): badge "Validar
 * pago", filtro "Por validar" y el modal de validación (fecha obligatoria no
 * futura, monto; sin conexión queda bloqueado y no se encola).
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionsScreen from "../(tabs)/transactions";
import * as recurringApi from "@/api/recurring.api";
import * as transactionsApi from "@/api/transactions.api";
import * as localRepo from "@/database/local.repository";
import { toast } from "@/utils/toast";
import type { TransactionRecordResponse } from "@/types/transaction.types";

let mockState = { userId: 7, isGuest: false, isOnline: true };
let mockParams: { validate?: string } = {};

jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockState),
}));
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: (sel: (s: unknown) => unknown) => sel(mockState),
}));
jest.mock("@/api/recurring.api", () => ({ validateRecurringTransaction: jest.fn() }));
jest.mock("@/api/transactions.api", () => ({ getTransactions: jest.fn() }));
jest.mock("@/api/catalog.api", () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  getSubcategories: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/api/banking.api", () => ({
  getBankAccounts: jest.fn().mockResolvedValue([]),
  getFinancialAssets: jest.fn().mockResolvedValue([]),
  getFinancialLiabilities: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/api/objectives.api", () => ({ getObjectives: jest.fn().mockResolvedValue([]) }));
jest.mock("@/api/empresas.api", () => ({ getCompanies: jest.fn().mockResolvedValue([]) }));
jest.mock("@/database/local.repository", () => ({
  saveTransactions: jest.fn().mockResolvedValue(undefined),
  getLocalTransactions: jest.fn().mockResolvedValue([]),
  getLocalCategories: jest.fn().mockResolvedValue([]),
  getLocalSubcategories: jest.fn().mockResolvedValue([]),
  getLocalBankAccounts: jest.fn().mockResolvedValue([]),
  getLocalFinancialLiabilities: jest.fn().mockResolvedValue([]),
  getLocalObjectives: jest.fn().mockResolvedValue([]),
  getLocalCompanies: jest.fn().mockResolvedValue([]),
  getLocalFinancialAssets: jest.fn().mockResolvedValue([]),
  enqueuePendingOperation: jest.fn(),
}));
// El swipe-to-delete usa gestos nativos: aquí basta un doble que deje pasar a los hijos.
jest.mock("react-native-gesture-handler", () => {
  const chain: Record<string, unknown> = {};
  const builder = new Proxy(chain, { get: () => () => builder });
  return {
    Gesture: { Pan: () => builder },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("@/hooks/useOfflineMutations", () => ({ useOfflineMutations: () => ({}) }));
jest.mock("@/utils/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

function tx(overrides: Partial<TransactionRecordResponse> = {}): TransactionRecordResponse {
  return {
    id: 11,
    user_id: 7,
    category_id: null,
    type: "expense",
    amount: 45000,
    currency: "COP",
    is_fixed: false,
    description: "Netflix",
    transaction_date: "2026-10-01T00:00:00Z",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: null,
    recurring_id: 1,
    needs_validation: true,
    ...overrides,
  };
}

const normal = tx({ id: 12, description: "Mercado", needs_validation: false, recurring_id: null });

function setList(rows: TransactionRecordResponse[]) {
  (transactionsApi.getTransactions as jest.Mock).mockResolvedValue({ data: rows, total: rows.length });
  (localRepo.getLocalTransactions as jest.Mock).mockResolvedValue(rows);
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <TransactionsScreen />
    </QueryClientProvider>,
  );
}

function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { userId: 7, isGuest: false, isOnline: true };
  mockParams = {};
  setList([tx(), normal]);
});

it("muestra el badge solo en la transacción con needs_validation, también sin conexión", async () => {
  mockState.isOnline = false;
  renderScreen();
  expect(await screen.findByText("Netflix")).toBeTruthy();
  expect(screen.getAllByText("Validar pago")).toHaveLength(1);
});

it("el filtro Por validar deja solo las transacciones por validar", async () => {
  renderScreen();
  expect(await screen.findByText("Mercado")).toBeTruthy();
  fireEvent.press(screen.getByText("Por validar"));
  expect(screen.queryByText("Mercado")).toBeNull();
  expect(screen.getByText("Netflix")).toBeTruthy();
});

it("validar sin fecha o con fecha futura no envía al API", async () => {
  renderScreen();
  fireEvent.press(await screen.findByLabelText("Validar pago Netflix"));
  const dateInput = screen.getByPlaceholderText("2026-10-05");
  expect(dateInput.props.value).toBe(localDay());

  fireEvent.changeText(dateInput, "");
  fireEvent.press(screen.getByText("Validar"));
  expect(screen.getByText(/Escribe la fecha real/)).toBeTruthy();

  fireEvent.changeText(dateInput, localDay(1));
  fireEvent.press(screen.getByText("Validar"));
  expect(screen.getByText("La fecha del pago no puede ser futura")).toBeTruthy();
  expect(recurringApi.validateRecurringTransaction).not.toHaveBeenCalled();
});

it("validar envía el id de la fila, fecha y monto, y no encola", async () => {
  (recurringApi.validateRecurringTransaction as jest.Mock).mockResolvedValue(
    tx({ needs_validation: false }),
  );
  renderScreen();
  fireEvent.press(await screen.findByLabelText("Validar pago Netflix"));
  fireEvent.changeText(screen.getByPlaceholderText("2026-10-05"), "2026-10-02");
  fireEvent.press(screen.getByText("Validar"));

  await waitFor(() =>
    expect(recurringApi.validateRecurringTransaction).toHaveBeenCalledWith(7, 11, {
      transaction_date: "2026-10-02",
      amount: 45000,
    }),
  );
  await waitFor(() => expect(localRepo.saveTransactions).toHaveBeenCalled());
  expect(localRepo.enqueuePendingOperation).not.toHaveBeenCalled();
});

it("un error del API (409) se muestra en toast", async () => {
  (recurringApi.validateRecurringTransaction as jest.Mock).mockRejectedValue(
    new Error("La transacción ya fue validada"),
  );
  renderScreen();
  fireEvent.press(await screen.findByLabelText("Validar pago Netflix"));
  fireEvent.press(screen.getByText("Validar"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La transacción ya fue validada"));
});

it("sin conexión validar queda deshabilitado con el aviso", async () => {
  mockState.isOnline = false;
  renderScreen();
  fireEvent.press(await screen.findByLabelText("Validar pago Netflix"));
  expect(screen.getByText("Necesitas conexión para validar un pago")).toBeTruthy();
  fireEvent.press(screen.getByText("Validar"));
  expect(recurringApi.validateRecurringTransaction).not.toHaveBeenCalled();
});

it("?validate=<id> abre la validación de esa transacción", async () => {
  mockParams = { validate: "11" };
  renderScreen();
  expect(await screen.findByPlaceholderText("2026-10-05")).toBeTruthy();
});

it("?validate=<id> de una transacción que no está en la lista avisa", async () => {
  mockParams = { validate: "999" };
  renderScreen();
  await waitFor(() => expect(toast.info).toHaveBeenCalled());
});
