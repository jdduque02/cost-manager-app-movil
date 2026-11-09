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
import type { BankAccountResponse, FinancialLiabilityResponse } from "@/types/banking.types";

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

const SAVINGS: BankAccountResponse = {
  ...ACCOUNTS[1],
  id: 4,
  bank_name: "Nu",
  account_type: "ahorro_alto_rendimiento",
  masked_account_number: "****4444",
};
const SAVINGS_2: BankAccountResponse = {
  ...SAVINGS,
  id: 5,
  bank_name: "Lulo",
  account_type: "cdt",
  masked_account_number: "****5555",
};
const LIABILITY = { id: 9, name: "Tarjeta Visa", currency: "COP" } as FinancialLiabilityResponse;

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
    fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
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
    fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
    const davivienda = screen.getAllByText("Davivienda ****5678 · COP");
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

  it("muestra la moneda en los selectores y avisa si el destino es la otra moneda (R7.2, R7.3)", () => {
    const usd = { ...ACCOUNTS[1], id: 3, bank_name: "Global66", masked_account_number: "****9999", currency: "USD" };
    renderWithClient(
      <TransferModal
        visible
        userId={1}
        isOnline
        bankAccounts={[ACCOUNTS[0], usd]}
        liabilities={[]}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );
    const NOTICE = "Se registrará en USD con la TRM oficial de la fecha";
    fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
    expect(screen.getByText("Monto (COP)")).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();

    const global66 = screen.getAllByText("Global66 ****9999 · USD");
    fireEvent.press(global66[global66.length - 1]);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  describe("Es ahorro (RF-11)", () => {
    function renderModal() {
      (transfersApi.createTransfer as jest.Mock).mockResolvedValue({});
      renderWithClient(
        <TransferModal
          visible
          userId={1}
          isOnline
          bankAccounts={[ACCOUNTS[0], SAVINGS, SAVINGS_2]}
          liabilities={[LIABILITY]}
          onClose={() => {}}
          onCreated={() => {}}
        />,
      );
    }
    const pressLast = (label: string) => {
      const chips = screen.getAllByText(label);
      fireEvent.press(chips[chips.length - 1]);
    };
    const savingsSwitch = () => screen.getByLabelText("Es ahorro");
    async function submitAndGetPayload() {
      fireEvent.changeText(screen.getByTestId("transfer-amount-input"), "1000");
      fireEvent.press(screen.getByText("Transferir"));
      await waitFor(() => expect(transfersApi.createTransfer).toHaveBeenCalled());
      return (transfersApi.createTransfer as jest.Mock).mock.calls[0][1];
    }

    it("se marca con destino de ahorro y lo envía en true", async () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      pressLast("Nu ****4444 · COP");
      expect(savingsSwitch().props.value).toBe(true);
      expect(await submitAndGetPayload()).toEqual(
        expect.objectContaining({ destination_account_id: 4, is_savings: true }),
      );
    });

    it("desmarcarla a mano envía false", async () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      pressLast("Nu ****4444 · COP");
      fireEvent(savingsSwitch(), "valueChange", false);
      expect(savingsSwitch().props.value).toBe(false);
      expect(await submitAndGetPayload()).toEqual(
        expect.objectContaining({ is_savings: false }),
      );
    });

    it("re-tocar un chip ya elegido conserva la marca manual", () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      pressLast("Nu ****4444 · COP");
      fireEvent(savingsSwitch(), "valueChange", false);
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      pressLast("Nu ****4444 · COP");
      expect(savingsSwitch().props.value).toBe(false);
    });

    it("entre dos cuentas de ahorro queda desmarcada", () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Nu ****4444 · COP")[0]);
      pressLast("Lulo ****5555 · COP");
      expect(savingsSwitch().props.value).toBe(false);
    });

    it("queda deshabilitada hasta elegir las dos cuentas (RF-18)", () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      expect(savingsSwitch().props.disabled).toBe(true);
      pressLast("Nu ****4444 · COP");
      expect(savingsSwitch().props.disabled).toBe(false);
    });

    it("con pasivo queda deshabilitada y no envía is_savings", async () => {
      renderModal();
      fireEvent.press(screen.getAllByText("Bancolombia ****1234 · COP")[0]);
      pressLast("Nu ****4444 · COP");
      fireEvent.press(screen.getByText("Pasivo (pago de deuda)"));
      pressLast("Tarjeta Visa · COP");
      expect(savingsSwitch().props.value).toBe(false);
      expect(savingsSwitch().props.disabled).toBe(true);
      const payload = await submitAndGetPayload();
      expect(payload).toEqual(expect.objectContaining({ destination_liability_id: 9 }));
      expect(payload).not.toHaveProperty("is_savings");
    });
  });
});
