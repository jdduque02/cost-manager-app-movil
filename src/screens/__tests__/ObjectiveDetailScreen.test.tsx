/**
 * Tests de renderizado para src/screens/ObjectiveDetailScreen.tsx.
 *
 * Foco: la fila condicional "Meses de gastos cubiertos" en la sección
 * "Detalles del progreso" (type guard `.filter` sobre entradas potencialmente
 * null antes del `.map`); y el flujo de confirmación de pago vía
 * `ConfirmModal` (ya no `Alert.alert`). Mockea `useOfflineQuery` directamente
 * (con datos ya resueltos) para no depender de red/SQLite real, y
 * expo-router/stores para poder renderizar la pantalla de forma aislada.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ObjectiveDetailScreen from "../ObjectiveDetailScreen";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import * as objectivesApi from "@/api/objectives.api";
import type { FinancialObjectiveResponse } from "@/types/objective.types";

jest.mock("@/hooks/useOfflineQuery", () => ({
  useOfflineQuery: jest.fn(),
}));

jest.mock("@/api/objectives.api", () => ({
  createObjectivePayment: jest.fn(),
}));

jest.mock("@/store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "1" }),
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseOfflineQuery = useOfflineQuery as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;

function baseObjective(
  overrides: Partial<FinancialObjectiveResponse> = {},
): FinancialObjectiveResponse {
  return {
    id: 1,
    user_id: 5,
    name: "Fondo de emergencia",
    type: "emergency_fund",
    target_amount: 5000000,
    current_balance: 1250000,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    is_completed: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    months_of_expenses_covered: null,
    ...overrides,
  };
}

/** Configura ambas llamadas a useOfflineQuery (objetivo y pagos) según la queryKey. */
function setupOfflineQuery(objective: FinancialObjectiveResponse | null) {
  mockUseOfflineQuery.mockImplementation(
    (options: { queryKey: unknown[] }) => {
      const key = options.queryKey[0];
      if (key === "objective") {
        return {
          data: objective,
          isLoading: false,
          refetch: jest.fn(),
        };
      }
      return {
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      };
    },
  );
}

function renderScreen(objective: FinancialObjectiveResponse | null) {
  setupOfflineQuery(objective);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ObjectiveDetailScreen />
    </QueryClientProvider>,
  );
}

const mockCreateObjectivePayment = objectivesApi.createObjectivePayment as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateObjectivePayment.mockResolvedValue({
    id: 1,
    objective_id: 1,
    user_id: 5,
    amount: 100000,
    payment_date: "2026-09-13",
    created_at: "2026-09-13T00:00:00Z",
  });
  mockUseAuthStore.mockImplementation(
    (selector?: (s: { userId: number }) => unknown) => {
      const state = { userId: 5 };
      return selector ? selector(state) : state;
    },
  );
  mockUseOfflineStore.mockImplementation(
    (selector?: (s: { isOnline: boolean }) => unknown) => {
      const state = { isOnline: true };
      return selector ? selector(state) : state;
    },
  );
});

describe("ObjectiveDetailScreen — fila 'Meses de gastos cubiertos'", () => {
  it("muestra la fila con el valor formateado a 1 decimal para un objetivo emergency_fund con valor", () => {
    renderScreen(
      baseObjective({ type: "emergency_fund", months_of_expenses_covered: 3.456 }),
    );

    expect(screen.getByText("Meses de gastos cubiertos")).toBeTruthy();
    expect(screen.getByText("3.5 meses")).toBeTruthy();
  });

  it("no muestra la fila para un objetivo emergency_fund sin valor calculado aún", () => {
    renderScreen(
      baseObjective({ type: "emergency_fund", months_of_expenses_covered: null }),
    );

    expect(screen.queryByText("Meses de gastos cubiertos")).toBeNull();
  });

  it("no muestra la fila para un objetivo de otro tipo, incluso si months_of_expenses_covered viene poblado por error", () => {
    renderScreen(
      baseObjective({ type: "savings", months_of_expenses_covered: 3.5 }),
    );

    expect(screen.queryByText("Meses de gastos cubiertos")).toBeNull();
  });
});

describe("ObjectiveDetailScreen — confirmar pago vía ConfirmModal", () => {
  it("abre el ConfirmModal al registrar el monto y confirma el pago", async () => {
    renderScreen(baseObjective({ current_balance: 1250000, target_amount: 5000000 }));

    fireEvent.press(screen.getByText("Registrar pago"));

    const amountInput = screen.getByTestId("pay-amount-input");
    fireEvent.changeText(amountInput, "100000");

    fireEvent.press(screen.getByText("Confirmar"));

    expect(screen.getByText("Confirmar pago")).toBeTruthy();
    expect(screen.getByText(/no se puede deshacer/)).toBeTruthy();

    fireEvent.press(screen.getByText("Sí, registrar pago"));

    await waitFor(() =>
      expect(mockCreateObjectivePayment).toHaveBeenCalledWith(
        5,
        1,
        100000,
        expect.any(String),
        undefined,
      ),
    );
  });

  it("cierra el ConfirmModal sin registrar el pago al cancelar", () => {
    renderScreen(baseObjective({ current_balance: 1250000, target_amount: 5000000 }));

    fireEvent.press(screen.getByText("Registrar pago"));
    fireEvent.changeText(screen.getByTestId("pay-amount-input"), "100000");
    fireEvent.press(screen.getByText("Confirmar"));

    expect(screen.getByText("Confirmar pago")).toBeTruthy();

    fireEvent.press(screen.getByText("Volver"));

    expect(screen.queryByText(/no se puede deshacer/)).toBeNull();
    expect(mockCreateObjectivePayment).not.toHaveBeenCalled();
  });
});
