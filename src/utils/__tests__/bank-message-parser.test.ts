import { parseBankMessage } from "@/utils/bank-message-parser";

describe("parseBankMessage — Bancolombia", () => {
  it("parsea una compra con establecimiento, monto y fecha/hora", () => {
    const result = parseBankMessage(
      "Bancolombia le informa Compra por $85.900 en RAPPI* RESTAURANTE el 26/04/2026 21:34. Inquietudes 018000931987",
    );
    expect(result.bank).toBe("bancolombia");
    expect(result.amount).toBe(85900);
    expect(result.date).toBe("2026-04-26");
    expect(result.time).toBe("21:34");
    expect(result.counterparty).toBe("RAPPI* RESTAURANTE");
    expect(result.type).toBe("expense");
  });

  it("parsea una transferencia recibida con remitente", () => {
    const result = parseBankMessage(
      "Su Bancolombia a las 07:15 le informa Recibio una Transferencia por $500.000 de JUAN CARLOS PEREZ el 01/05/2026",
    );
    expect(result.bank).toBe("bancolombia");
    expect(result.amount).toBe(500000);
    expect(result.date).toBe("2026-05-01");
    expect(result.counterparty).toBe("JUAN CARLOS PEREZ");
    expect(result.type).toBe("income");
  });

  it("parsea fecha con nombre de mes y establecimiento con 'EL' en el nombre", () => {
    const result = parseBankMessage(
      "BANCOLOMBIA: Compra aprobada $45.000 en EXITO EL TESORO el 15-MAY-2026 12:03. Saldo $1.234.567",
    );
    expect(result.bank).toBe("bancolombia");
    expect(result.amount).toBe(45000);
    expect(result.date).toBe("2026-05-15");
    expect(result.time).toBe("12:03");
    expect(result.counterparty).toBe("EXITO EL TESORO");
    expect(result.type).toBe("expense");
  });
});

describe("parseBankMessage — Nequi", () => {
  it("parsea un envío de dinero", () => {
    const result = parseBankMessage(
      "Nequi: Enviaste $50.000 a MARIA LOPEZ el 26/04/2026 08:12. Saldo disponible $120.000",
    );
    expect(result.bank).toBe("nequi");
    expect(result.amount).toBe(50000);
    expect(result.date).toBe("2026-04-26");
    expect(result.time).toBe("08:12");
    expect(result.counterparty).toBe("MARIA LOPEZ");
    expect(result.type).toBe("expense");
  });

  it("parsea dinero recibido", () => {
    const result = parseBankMessage(
      "Nequi: Recibiste $200.000 de PEDRO GOMEZ. 26/04/2026 09:00",
    );
    expect(result.bank).toBe("nequi");
    expect(result.amount).toBe(200000);
    expect(result.date).toBe("2026-04-26");
    expect(result.counterparty).toBe("PEDRO GOMEZ");
    expect(result.type).toBe("income");
  });

  it("parsea un pago en comercio", () => {
    const result = parseBankMessage(
      "Nequi: Pagaste $15.000 en TIENDA D1 el 26/04/2026 18:45",
    );
    expect(result.bank).toBe("nequi");
    expect(result.amount).toBe(15000);
    expect(result.date).toBe("2026-04-26");
    expect(result.type).toBe("expense");
  });
});

describe("parseBankMessage — fallback y tolerancia", () => {
  it("no crashea y devuelve bank 'unknown' con campos nulos si el texto no matchea ningún patrón", () => {
    const result = parseBankMessage("Tu pedido ha sido enviado y llegará mañana.");
    expect(result.bank).toBe("unknown");
    expect(result.amount).toBeNull();
    expect(result.date).toBeNull();
    expect(result.counterparty).toBeNull();
    expect(result.type).toBeNull();
    expect(result.rawText).toBe("Tu pedido ha sido enviado y llegará mañana.");
  });

  it("no crashea con texto vacío", () => {
    const result = parseBankMessage("");
    expect(result.bank).toBe("unknown");
    expect(result.amount).toBeNull();
    expect(result.rawText).toBe("");
  });

  it("no crashea con input undefined/null forzado", () => {
    expect(() => parseBankMessage(undefined as unknown as string)).not.toThrow();
    expect(() => parseBankMessage(null as unknown as string)).not.toThrow();
  });
});
