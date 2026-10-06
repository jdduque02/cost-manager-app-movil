import { consolidate } from "../net-worth";

const TRM = { value: 4000, valid_from: "2026-10-03", valid_to: "2026-10-06", source: "datos.gov.co" };

describe("consolidate (R6.1–R6.4, R6.9)", () => {
  it("COP + USD×TRM con los pasivos restados; desglose y nota con la fecha de la TRM", () => {
    const c = consolidate(
      [
        ["COP", 1_000_000],
        ["USD", 100],
        ["COP", -200_000],
      ],
      TRM,
    );
    expect(c.total).toBe(1_200_000);
    expect(c.breakdown).toMatch(/^\$\s?800\.000 · US\$\s?100,00$/);
    expect(c.note).toMatch(/· USD a TRM del 3 .*oct.* 2026$/);
  });

  it("otra moneda queda fuera del total y solo sale en el desglose", () => {
    const c = consolidate(
      [
        ["COP", 500_000],
        ["EUR", 50],
      ],
      TRM,
    );
    expect(c.total).toBe(500_000);
    expect(c.breakdown).toMatch(/EUR|€/);
    expect(c.note).not.toMatch(/TRM/);
  });

  it("solo en EUR: total 0 pero el desglose sale en la nota", () => {
    const c = consolidate([["EUR", 50]], TRM);
    expect(c.total).toBe(0);
    expect(c.note).toMatch(/EUR|€/);
  });

  it("sin TRM y con saldo en USD: sin total ni nota, solo el desglose", () => {
    const c = consolidate(
      [
        ["COP", 500_000],
        ["USD", 10],
      ],
      null,
    );
    expect(c.total).toBeNull();
    expect(c.note).toBeNull();
    expect(c.breakdown).toMatch(/US\$/);
  });

  it("sin saldo en USD el total sale sin TRM y la moneda en 0 no aparece", () => {
    const c = consolidate(
      [
        ["COP", 300_000],
        ["USD", 0],
      ],
      null,
    );
    expect(c.total).toBe(300_000);
    expect(c.breakdown).not.toMatch(/US\$/);
    expect(c.note).toBeNull();
  });
});
