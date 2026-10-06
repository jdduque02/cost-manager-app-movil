/**
 * R7.1 en la pantalla de compartir: el mensaje del banco casi siempre trae
 * monto, así que la moneda no cambia sola a la de la cuenta inferida; solo con
 * el monto vacío se hereda. Con moneda distinta, el aviso de R7.3.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import ShareTransactionConfirmScreen from "../ShareTransactionConfirmScreen";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import type { BankAccountResponse } from "@/types/banking.types";

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/hooks/useOfflineQuery", () => ({ useOfflineQuery: jest.fn() }));
jest.mock("@/hooks/useOfflineMutations", () => ({
  useOfflineMutations: () => ({ createTransaction: jest.fn() }),
}));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: { userId: number }) => unknown) => sel({ userId: 7 }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const USD_BANCOLOMBIA = {
  id: 3,
  bank_name: "Bancolombia",
  masked_account_number: "****1234",
  currency: "USD",
} as BankAccountResponse;
const NOTICE = "Se registrará en USD con la TRM oficial de la fecha";

beforeEach(() => {
  (useOfflineQuery as jest.Mock).mockImplementation((opts: { queryKey: unknown[] }) => ({
    data: opts.queryKey[0] === "bank-accounts" ? [USD_BANCOLOMBIA] : [],
  }));
});

it("con monto en el mensaje la moneda se queda en COP y avisa la conversión", () => {
  render(
    <ShareTransactionConfirmScreen sharedText="Bancolombia le informa Compra por $85.900 en RAPPI el 26/04/2026 21:34." />,
  );
  expect(screen.getByRole("button", { name: "COP", selected: true })).toBeTruthy();
  expect(screen.getByText(NOTICE)).toBeTruthy();
});

it("sin monto hereda la moneda de la cuenta inferida", () => {
  render(<ShareTransactionConfirmScreen sharedText="Bancolombia le informa algo sin monto" />);
  expect(screen.getByRole("button", { name: "USD", selected: true })).toBeTruthy();
  expect(screen.queryByText(NOTICE)).toBeNull();
});
