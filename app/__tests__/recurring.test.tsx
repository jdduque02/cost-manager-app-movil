/**
 * app/recurring.tsx (R6.1, R8.4, R8.5): sin conexión muestra el caché SQLite
 * con las escrituras deshabilitadas; con conexión crear va directo al API y
 * nunca a `pending_operations`; el invitado no ve la entrada en Transacciones.
 * Usa el `useOfflineQuery` real para probar el respaldo del caché.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import RecurringScreen from "../recurring";
import TransactionsScreen from "../(tabs)/transactions";
import * as recurringApi from "@/api/recurring.api";
import * as localRepo from "@/database/local.repository";
import type { RecurringTransaction } from "@/types/recurring.types";

let mockState = { userId: 7, isGuest: false, isOnline: true };

jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockState),
}));
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: (sel: (s: unknown) => unknown) => sel(mockState),
}));
jest.mock("@/api/recurring.api", () => ({
  listRecurring: jest.fn(),
  createRecurring: jest.fn(),
  updateRecurring: jest.fn(),
  cancelRecurring: jest.fn(),
}));
jest.mock("@/api/catalog.api", () => ({ getCategories: jest.fn().mockResolvedValue([]) }));
jest.mock("@/api/banking.api", () => ({
  getBankAccounts: jest.fn().mockResolvedValue([
    { id: 3, bank_name: "Bancolombia", masked_account_number: "****1234", currency: "COP" },
  ]),
  getFinancialLiabilities: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/database/local.repository", () => ({
  saveRecurringTransactions: jest.fn().mockResolvedValue(undefined),
  getLocalRecurringTransactions: jest.fn(),
  getLocalCategories: jest.fn().mockResolvedValue([]),
  getLocalBankAccounts: jest.fn().mockResolvedValue([]),
  getLocalFinancialLiabilities: jest.fn().mockResolvedValue([]),
  getLocalTransactions: jest.fn().mockResolvedValue([]),
  getLocalObjectives: jest.fn().mockResolvedValue([]),
  getLocalCompanies: jest.fn().mockResolvedValue([]),
  getLocalFinancialAssets: jest.fn().mockResolvedValue([]),
  enqueuePendingOperation: jest.fn(),
}));
// Transacciones: solo se prueba su cabecera; sus mutaciones offline no aplican aquí.
jest.mock("@/hooks/useOfflineMutations", () => ({ useOfflineMutations: () => ({}) }));
jest.mock("@/utils/toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

function rule(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 1,
    name: "Arriendo",
    type: "expense",
    amount: 1500000,
    currency: "COP",
    category_id: null,
    subcategory_id: null,
    account_id: 3,
    liability_id: null,
    origin_account_id: null,
    destination_account_id: null,
    destination_liability_id: null,
    payment_method: null,
    frequency: "monthly",
    start_date: "2026-10-01",
    next_due_date: "2026-11-01",
    end_date: null,
    max_occurrences: 12,
    occurrences_count: 1,
    remaining_occurrences: 11,
    mode: "auto",
    reminder_days: 1,
    status: "active",
    pending_validation_count: 2,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { userId: 7, isGuest: false, isOnline: true };
});

it("sin conexión muestra el caché y deshabilita las escrituras", async () => {
  mockState.isOnline = false;
  (localRepo.getLocalRecurringTransactions as jest.Mock).mockResolvedValue([rule()]);

  renderWithClient(<RecurringScreen />);

  expect(await screen.findByText("Arriendo")).toBeTruthy();
  expect(recurringApi.listRecurring).not.toHaveBeenCalled();
  expect(screen.getByText("1 de 12 cuotas", { exact: false })).toBeTruthy();
  expect(screen.getByText("2 por validar")).toBeTruthy();
  expect(screen.getByText(/Necesitas conexión para/)).toBeTruthy();
  expect(screen.getByLabelText("Nuevo recurrente").props.accessibilityState?.disabled).toBe(true);
  expect(screen.getByLabelText("Editar Arriendo").props.accessibilityState?.disabled).toBe(true);
  expect(screen.getByLabelText("Cancelar Arriendo").props.accessibilityState?.disabled).toBe(true);
});

it("con conexión pide la lista completa, la cachea y crear va al API sin encolar", async () => {
  (recurringApi.listRecurring as jest.Mock).mockResolvedValue([rule()]);
  (recurringApi.createRecurring as jest.Mock).mockResolvedValue(rule({ id: 2 }));

  renderWithClient(<RecurringScreen />);
  expect(await screen.findByText("Arriendo")).toBeTruthy();
  expect(recurringApi.listRecurring).toHaveBeenCalledWith(7);
  expect(localRepo.saveRecurringTransactions).toHaveBeenCalledWith(7, [expect.objectContaining({ id: 1 })]);

  fireEvent.press(screen.getByLabelText("Nuevo recurrente"));
  fireEvent.changeText(screen.getByPlaceholderText("Ej: Arriendo"), "Netflix");
  fireEvent.changeText(screen.getByTestId("recurring-amount-input"), "45000");
  fireEvent.press(await screen.findByText("Bancolombia ****1234"));
  fireEvent.press(screen.getByText("Crear"));

  await waitFor(() =>
    expect(recurringApi.createRecurring).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        name: "Netflix",
        type: "expense",
        amount: 45000,
        account_id: 3,
        frequency: "monthly",
        mode: "confirm",
        reminder_days: 1,
      }),
    ),
  );
  expect(localRepo.enqueuePendingOperation).not.toHaveBeenCalled();
});

it("el invitado no ve la entrada en Transacciones", async () => {
  mockState.isGuest = true;
  const { unmount } = renderWithClient(<TransactionsScreen />);
  expect(await screen.findByText("Transacciones")).toBeTruthy();
  expect(screen.queryByText("Recurrentes")).toBeNull();
  unmount();

  mockState.isGuest = false;
  renderWithClient(<TransactionsScreen />);
  fireEvent.press(await screen.findByText("Recurrentes"));
  expect(router.push).toHaveBeenCalledWith("/recurring");
});

it("editar de N veces a sin fin envía end_date y max_occurrences en null", async () => {
  (recurringApi.listRecurring as jest.Mock).mockResolvedValue([rule()]);
  (recurringApi.updateRecurring as jest.Mock).mockResolvedValue(rule({ max_occurrences: null }));

  renderWithClient(<RecurringScreen />);
  fireEvent.press(await screen.findByLabelText("Editar Arriendo"));
  fireEvent.press(screen.getByText("Sin fin"));
  fireEvent.press(screen.getByText("Guardar"));

  await waitFor(() =>
    expect(recurringApi.updateRecurring).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ end_date: null, max_occurrences: null, account_id: 3, liability_id: null }),
    ),
  );
  expect(localRepo.enqueuePendingOperation).not.toHaveBeenCalled();
});

it("editar quitando la categoría envía category_id y subcategory_id en null", async () => {
  const catalogApi = jest.requireMock("@/api/catalog.api");
  catalogApi.getCategories.mockResolvedValueOnce([{ id: 5, name: "Vivienda" }]);
  (recurringApi.listRecurring as jest.Mock).mockResolvedValue([rule({ category_id: 5, subcategory_id: 9 })]);
  (recurringApi.updateRecurring as jest.Mock).mockResolvedValue(rule());

  renderWithClient(<RecurringScreen />);
  fireEvent.press(await screen.findByLabelText("Editar Arriendo"));
  fireEvent.press(await screen.findByText("Vivienda"));
  fireEvent.press(screen.getByText("Guardar"));

  await waitFor(() =>
    expect(recurringApi.updateRecurring).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ category_id: null, subcategory_id: null }),
    ),
  );
});

it("editar una regla adoptada sin cuenta ni pasivo no exige elegirlos ni los envía", async () => {
  const { toast } = jest.requireMock("@/utils/toast");
  (recurringApi.listRecurring as jest.Mock).mockResolvedValue([rule({ account_id: null })]);
  (recurringApi.updateRecurring as jest.Mock).mockResolvedValue(rule({ account_id: null }));

  renderWithClient(<RecurringScreen />);
  fireEvent.press(await screen.findByLabelText("Editar Arriendo"));
  fireEvent.press(screen.getByText("Guardar"));

  await waitFor(() => expect(recurringApi.updateRecurring).toHaveBeenCalled());
  const dto = (recurringApi.updateRecurring as jest.Mock).mock.calls[0][2];
  expect(dto).not.toHaveProperty("account_id");
  expect(dto).not.toHaveProperty("liability_id");
  expect(toast.error).not.toHaveBeenCalled();
});

it("en la transferencia la cuenta destino no aparece como origen", async () => {
  const bankingApi = jest.requireMock("@/api/banking.api");
  bankingApi.getBankAccounts.mockResolvedValueOnce([
    { id: 3, bank_name: "Bancolombia", masked_account_number: "****1234", currency: "COP" },
    { id: 4, bank_name: "Davivienda", masked_account_number: "****5678", currency: "COP" },
  ]);
  (recurringApi.listRecurring as jest.Mock).mockResolvedValue([
    rule({ type: "transfer", account_id: null, origin_account_id: 3, destination_account_id: 4 }),
  ]);

  renderWithClient(<RecurringScreen />);
  fireEvent.press(await screen.findByLabelText("Editar Arriendo"));
  expect(await screen.findByText("Bancolombia ****1234")).toBeTruthy();
  expect(screen.queryByText("Davivienda ****5678")).toBeNull();
});
