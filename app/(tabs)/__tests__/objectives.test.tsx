/**
 * Tests de renderizado para app/(tabs)/objectives.tsx.
 *
 * Foco: el badge "X.X meses cubiertos" del `renderItem` de la lista, que solo
 * debe aparecer para `type === "emergency_fund"` con
 * `months_of_expenses_covered` no nulo. Mockea `useOfflineQuery` (datos ya
 * resueltos), `useOfflineMutations` y los stores/expo-router necesarios para
 * renderizar la pantalla de forma aislada, sin depender de red/SQLite real.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ObjectivesScreen from "../objectives";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import type { FinancialObjectiveResponse } from "@/types/objective.types";

jest.mock("@/hooks/useOfflineQuery", () => ({
  useOfflineQuery: jest.fn(),
}));

jest.mock("@/hooks/useOfflineMutations", () => ({
  useOfflineMutations: jest.fn(),
}));

jest.mock("@/store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

const mockUseOfflineQuery = useOfflineQuery as jest.Mock;
const mockUseOfflineMutations = useOfflineMutations as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;

function objective(
  overrides: Partial<FinancialObjectiveResponse> = {},
): FinancialObjectiveResponse {
  return {
    id: 1,
    user_id: 5,
    name: "Mi colchón financiero",
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

function renderScreen(objectives: FinancialObjectiveResponse[]) {
  mockUseOfflineQuery.mockReturnValue({
    data: objectives,
    isLoading: false,
    refetch: jest.fn(),
    isUsingFallback: false,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ObjectivesScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOfflineMutations.mockReturnValue({
    createObjective: jest.fn(),
    deleteObjective: jest.fn(),
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

describe("ObjectivesScreen — badge 'meses cubiertos'", () => {
  it('muestra "Fondo de emergencia" y el badge de meses para un objetivo emergency_fund con valor', () => {
    renderScreen([
      objective({ type: "emergency_fund", months_of_expenses_covered: 3.456 }),
    ]);

    expect(screen.getByText("Mi colchón financiero")).toBeTruthy();
    expect(screen.getByText("3.5 meses cubiertos")).toBeTruthy();
  });

  it("no muestra el badge de meses cuando months_of_expenses_covered es null", () => {
    renderScreen([
      objective({ type: "emergency_fund", months_of_expenses_covered: null }),
    ]);

    expect(screen.getByText("Mi colchón financiero")).toBeTruthy();
    expect(screen.queryByText(/meses cubiertos/)).toBeNull();
  });
});
