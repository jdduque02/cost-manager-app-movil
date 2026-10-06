import {
  PAYMENT_METHOD_OPTIONS,
  defaultFixedType,
  patrimonyKindOf,
  clearPatrimonyFields,
  setPatrimony,
  validateFixedAndInstallments,
  LIABILITY_LINK_HINT,
  todayBogota,
  TX_CURRENCIES,
  fxNotice,
  inheritCurrency,
  convertedLine,
} from "../transaction-form";

describe("todayBogota (R7.7)", () => {
  it("a las 20:00 de Bogotá (01:00 UTC del día siguiente) sigue siendo hoy", () => {
    expect(todayBogota(new Date("2026-10-04T20:00:00-05:00"))).toBe("2026-10-04");
  });

  it("a las 00:30 de Bogotá ya es el día nuevo", () => {
    expect(todayBogota(new Date("2026-10-05T00:30:00-05:00"))).toBe("2026-10-05");
  });
});

describe("currencyOptions / fxNotice (R7.1, R7.3)", () => {
  it("solo COP y USD, las que acepta el API", () => {
    expect(TX_CURRENCIES).toEqual(["COP", "USD"]);
  });

  it("hereda la moneda del producto solo con el monto vacío", () => {
    expect(inheritCurrency({ currency: "COP" }, "USD").currency).toBe("USD");
    expect(inheritCurrency({ currency: "COP", amount: 200000 }, "USD").currency).toBe("COP");
    expect(inheritCurrency({ currency: "COP" }, undefined).currency).toBe("COP");
    expect(inheritCurrency({ currency: "COP" }, "EUR").currency).toBe("COP");
  });

  it("avisa sin cifra solo cuando el par COP/USD difiere", () => {
    expect(fxNotice("COP", "USD")).toBe("Se registrará en USD con la TRM oficial de la fecha");
    expect(fxNotice("USD", "COP")).toBe("Se registrará en COP con la TRM oficial de la fecha");
    expect(fxNotice("COP", "COP")).toBeNull();
    expect(fxNotice("COP", undefined)).toBeNull();
    expect(fxNotice("USD", "EUR")).toBeNull();
  });
});

describe("convertedLine (R7.4)", () => {
  it("COP en producto USD: convertido en USD con la TRM y la nota", () => {
    expect(convertedLine({ currency: "COP", applied_amount: 97.56, fx_rate: 4100.25 })).toMatch(
      /^≈ US\$\s?97,56 · TRM 4\.100,25 \(aprox\.; tu banco puede usar otra tasa\)$/,
    );
  });

  it("USD en producto COP: convertido en pesos sin decimales", () => {
    expect(convertedLine({ currency: "USD", applied_amount: 205012.5, fx_rate: 4100.25 })).toMatch(
      /^≈ \$\s?205\.013 · TRM/,
    );
  });

  it("sin conversión, null", () => {
    expect(convertedLine({ currency: "COP", applied_amount: null, fx_rate: null })).toBeNull();
  });
});

describe("transaction-form utils", () => {
  it("la ayuda de pasivo dice que el gasto sube la deuda y que se paga con Transferir (R6.11)", () => {
    expect(LIABILITY_LINK_HINT).toContain("sube la deuda");
    expect(LIABILITY_LINK_HINT).toContain("Transferir");
    expect(LIABILITY_LINK_HINT).not.toMatch(/abono/i);
  });

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
