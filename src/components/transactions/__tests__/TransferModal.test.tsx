/**
 * Tests de renderizado/comportamiento para TransferModal.tsx.
 * Mockea transfers.api para no golpear la red real y verifica las
 * validaciones básicas y el bloqueo offline (las transferencias no tienen
 * soporte offline — ver comentario en el componente).
 */
import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransferModal } from "../TransferModal";
import * as transfersApi from "@/api/transfers.api";
import type { BankAccountResponse } from "@/types/banking.types";

jest.mock("@/api/transfers.api");
jest.spyOn(Alert, "alert").mockImplementation(() => {});

const ACCOUNTS: BankAccountResponse[] = [
  {
    id: 1,
    user_id: 1,
    bank_name: "Bancolombia",
    account_type: "ahorros",
    masked_account_number: "****1234",
    display_balance: "100000",
    currency: "COP",
    is_primary: true,
    created_at: "2026-01-01",
    updated_at: null,
  },
  {
    id: 2,
    user_id: 1,
    bank_name: "Davivienda",
    account_type: "corriente",
    masked_account_number: "****5678",
    display_balance: "50000",
    currency: "COP",
    is_primary: false,
    created_at: "2026-01-01",
    updated_at: null,
  },
];

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("TransferModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("bloquea el envío sin conexión", () => {
    renderWithClient(
      <TransferModal
        visible
        userId={1}
        isOnline={false}
        bankAccounts={ACCOUNTS}
        liabilities={[]}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );
    fireEvent.press(screen.getAllByText("Bancolombia ****1234")[0]);
    fireEvent.press(screen.getByText("Transferir"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Sin conexión",
      expect.stringContaining("conexión"),
    );
    expect(transfersApi.createTransfer).not.toHaveBeenCalled();
  });

  it("valida que haya cuenta origen y monto antes de enviar", () => {
    renderWithClient(
      <TransferModal
        visible
        userId={1}
        isOnline
        bankAccounts={ACCOUNTS}
        liabilities={[]}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );
    fireEvent.press(screen.getByText("Transferir"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Campos requeridos",
      expect.any(String),
    );
    expect(transfersApi.createTransfer).not.toHaveBeenCalled();
  });

  it("crea la transferencia con el payload correcto", async () => {
    (transfersApi.createTransfer as jest.Mock).mockResolvedValue({});
    const onCreated = jest.fn();
    renderWithClient(
      <TransferModal
        visible
        userId={7}
        isOnline
        bankAccounts={ACCOUNTS}
        liabilities={[]}
        onClose={() => {}}
        onCreated={onCreated}
      />,
    );
    fireEvent.press(screen.getAllByText("Bancolombia ****1234")[0]);
    const davivienda = screen.getAllByText("Davivienda ****5678");
    fireEvent.press(davivienda[davivienda.length - 1]);
    fireEvent.changeText(screen.getByTestId("transfer-amount-input"), "50000");
    fireEvent.press(screen.getByText("Transferir"));

    await waitFor(() => {
      expect(transfersApi.createTransfer).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          source_account_id: 1,
          destination_account_id: 2,
          amount: 50000,
        }),
      );
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
});
