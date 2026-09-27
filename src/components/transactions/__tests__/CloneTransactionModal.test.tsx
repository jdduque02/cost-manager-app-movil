/**
 * Tests de renderizado/comportamiento para CloneTransactionModal.tsx
 * (mini-formulario de duplicado de transacción).
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { CloneTransactionModal } from "../CloneTransactionModal";
import type { TransactionRecordResponse } from "@/types/transaction.types";

const TX: TransactionRecordResponse = {
  id: 1,
  user_id: 1,
  category_id: 2,
  type: "expense",
  amount: 15000,
  currency: "COP",
  is_fixed: false,
  description: "Supermercado",
  transaction_date: "2026-04-20",
  created_at: "2026-04-20",
  updated_at: null,
};

describe("CloneTransactionModal", () => {
  it("precarga los campos desde la transacción original", () => {
    render(
      <CloneTransactionModal
        visible
        transaction={TX}
        isPending={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByDisplayValue("Supermercado")).toBeTruthy();
    expect(screen.getByDisplayValue("2026-04-20")).toBeTruthy();
  });

  it("llama a onConfirm con los overrides al presionar Duplicar", () => {
    const onConfirm = jest.fn();
    render(
      <CloneTransactionModal
        visible
        transaction={TX}
        isPending={false}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.changeText(screen.getByDisplayValue("Supermercado"), "Mercado grande");
    fireEvent.press(screen.getByText("Duplicar"));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Mercado grande" }),
    );
  });

  it("llama a onClose al cancelar", () => {
    const onClose = jest.fn();
    render(
      <CloneTransactionModal
        visible
        transaction={TX}
        isPending={false}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    fireEvent.press(screen.getByText("Cancelar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
