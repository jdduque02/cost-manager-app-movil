import {
  PAYMENT_METHOD_OPTIONS,
  defaultFixedType,
  patrimonyKindOf,
  clearPatrimonyFields,
  setPatrimony,
  validateFixedAndInstallments,
} from "../transaction-form";

describe("transaction-form utils", () => {
  it("expone los 6 métodos de pago en el mismo orden que la web", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual([
      "bank_transfer",
      "cash",
      "debit_card",
      "credit_card",
      "digital_wallet",
      "mobile_payment",
    ]);
  });

  describe("defaultFixedType", () => {
    it("es fixed_income para ingresos", () => {
      expect(defaultFixedType("income")).toBe("fixed_income");
    });
    it("es deduction para gastos/inversiones", () => {
      expect(defaultFixedType("expense")).toBe("deduction");
      expect(defaultFixedType("investment")).toBe("deduction");
    });
  });

  describe("patrimonyKindOf", () => {
    it("detecta account", () => {
      expect(patrimonyKindOf({ account_id: 5 })).toBe("account");
    });
    it("detecta asset", () => {
      expect(patrimonyKindOf({ asset_id: 5 })).toBe("asset");
    });
    it("detecta liability", () => {
      expect(patrimonyKindOf({ liability_id: 5 })).toBe("liability");
    });
    it("null si no hay ninguno", () => {
      expect(patrimonyKindOf({})).toBeNull();
    });
  });

  describe("clearPatrimonyFields / setPatrimony", () => {
    it("limpia los tres campos", () => {
      const form = { account_id: 1, asset_id: 2, liability_id: 3, other: "x" };
      expect(clearPatrimonyFields(form)).toEqual({
        account_id: undefined,
        asset_id: undefined,
        liability_id: undefined,
        other: "x",
      });
    });

    it("setea solo el campo del tipo elegido y limpia los otros", () => {
      const form = { account_id: 1, asset_id: undefined, liability_id: undefined };
      expect(setPatrimony(form, "asset", 9)).toEqual({
        account_id: undefined,
        asset_id: 9,
        liability_id: undefined,
      });
    });
  });

  describe("validateFixedAndInstallments", () => {
    it("acepta valores dentro de rango", () => {
      expect(
        validateFixedAndInstallments({ installments: 12, due_day: 15, reminder_days: 3 }),
      ).toBeNull();
    });

    it("rechaza cuotas fuera de rango", () => {
      expect(validateFixedAndInstallments({ installments: 0 })).toMatch(/cuotas/);
      expect(validateFixedAndInstallments({ installments: 121 })).toMatch(/cuotas/);
    });

    it("rechaza día de vencimiento fuera de rango", () => {
      expect(validateFixedAndInstallments({ due_day: 0 })).toMatch(/vencimiento/);
      expect(validateFixedAndInstallments({ due_day: 32 })).toMatch(/vencimiento/);
    });

    it("rechaza días de recordatorio fuera de rango", () => {
      expect(validateFixedAndInstallments({ reminder_days: -1 })).toMatch(/recordatorio/);
      expect(validateFixedAndInstallments({ reminder_days: 31 })).toMatch(/recordatorio/);
    });
  });
});
