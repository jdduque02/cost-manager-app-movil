import { addDays, daysBetween, lastDayOfPreviousMonth, monthStart, todayInTimeZone } from "../today";

describe("todayInTimeZone", () => {
  const jan1Utc = new Date("2026-01-01T02:00:00Z");

  it("21:00 COT sigue siendo el mismo día en Bogotá", () => {
    expect(todayInTimeZone("America/Bogota", new Date("2026-03-10T02:00:00Z"))).toBe("2026-03-09");
  });

  it("respeta la zona: Bogotá vs Madrid", () => {
    expect(todayInTimeZone("America/Bogota", jan1Utc)).toBe("2025-12-31");
    expect(todayInTimeZone("Europe/Madrid", jan1Utc)).toBe("2026-01-01");
  });

  it("fin de mes 19:30 COT no salta al mes siguiente", () => {
    expect(todayInTimeZone("America/Bogota", new Date("2026-01-31T19:30:00-05:00"))).toBe(
      "2026-01-31",
    );
  });

  it("sin zona o zona inválida usa el respaldo -5 h", () => {
    expect(todayInTimeZone(undefined, jan1Utc)).toBe("2025-12-31");
    expect(todayInTimeZone("", jan1Utc)).toBe("2025-12-31");
    expect(todayInTimeZone("Mars/Olympus", jan1Utc)).toBe("2025-12-31");
  });

  it("si Intl.DateTimeFormat lanza usa el respaldo -5 h", () => {
    const spy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl no disponible");
    });
    try {
      expect(todayInTimeZone("Europe/Madrid", jan1Utc)).toBe("2025-12-31");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("helpers de periodos", () => {
  it("monthStart", () => {
    expect(monthStart("2026-10-13")).toBe("2026-10-01");
  });

  it("addDays cruza mes, año y bisiesto", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-10-13", -30)).toBe("2026-09-13");
  });

  it("daysBetween cuenta días entre cadenas, negativo si ya pasó", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-03-01", "2026-02-28")).toBe(-1);
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
  });

  it("lastDayOfPreviousMonth", () => {
    expect(lastDayOfPreviousMonth("2026-10-13")).toBe("2026-09-30");
    expect(lastDayOfPreviousMonth("2026-01-05")).toBe("2025-12-31");
    expect(lastDayOfPreviousMonth("2028-03-01")).toBe("2028-02-29");
  });
});
