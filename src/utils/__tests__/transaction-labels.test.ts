import {
  TRANSACTION_TYPES,
  TYPE_LABELS,
  TYPE_TONE,
  TYPE_ICON,
  TYPE_AMOUNT_CLASS,
  TYPE_TO_GROUP_TYPE,
} from "../transaction-labels";

describe("transaction-labels", () => {
  it("expone los 4 tipos de transacción", () => {
    expect(TRANSACTION_TYPES).toEqual(["income", "expense", "investment", "transfer"]);
  });

  it("TYPE_LABELS, TYPE_TONE, TYPE_ICON y TYPE_AMOUNT_CLASS cubren los 4 tipos", () => {
    for (const type of TRANSACTION_TYPES) {
      expect(TYPE_LABELS[type]).toEqual(expect.any(String));
      expect(TYPE_TONE[type]).toEqual(expect.any(String));
      expect(TYPE_ICON[type]).toBeDefined();
      expect(TYPE_AMOUNT_CLASS[type]).toEqual(expect.any(String));
    }
  });

  it("TYPE_LABELS tiene las etiquetas en español esperadas", () => {
    expect(TYPE_LABELS).toEqual({
      income: "Ingreso",
      expense: "Gasto",
      investment: "Inversión",
      transfer: "Transferencia",
    });
  });

  it("TYPE_TONE mapea cada tipo al tono de Badge esperado", () => {
    expect(TYPE_TONE).toEqual({
      income: "success",
      expense: "destructive",
      investment: "primary",
      transfer: "info",
    });
  });

  it("TYPE_AMOUNT_CLASS mapea cada tipo a la clase de color de Tailwind esperada", () => {
    expect(TYPE_AMOUNT_CLASS).toEqual({
      income: "text-success",
      expense: "text-destructive",
      investment: "text-primary",
      transfer: "text-info",
    });
  });

  it("TYPE_TO_GROUP_TYPE agrupa transfer como expense (GroupType no tiene transfer)", () => {
    expect(TYPE_TO_GROUP_TYPE).toEqual({
      income: "income",
      expense: "expense",
      investment: "investment",
      transfer: "expense",
    });
  });
});
