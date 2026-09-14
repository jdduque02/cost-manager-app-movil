/**
 * Tests unitarios para las funciones exportadas de src/database/database.service.ts
 * que no dependen de getDatabase()/loadSQLite() (import("expo-sqlite") literal no
 * es transformable por Jest sin tocar babel/jest config). Se testean directamente
 * rebuildObjectivesTableIfLegacyCheckExists y migrateObjectivesTable pasándoles un
 * `db` fake, sin pasar por el singleton real.
 */
import {
  rebuildObjectivesTableIfLegacyCheckExists,
  migrateObjectivesTable,
} from "../database.service";
import type * as SQLite from "expo-sqlite";

type FakeDb = {
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  withTransactionAsync: jest.Mock;
};

function createFakeDb(callOrder: string[]): FakeDb {
  return {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn().mockImplementation(async (sql: string) => {
      callOrder.push(`execAsync:${sql.trim().slice(0, 30)}`);
    }),
    runAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn().mockImplementation(async (cb: () => Promise<void>) => {
      callOrder.push("withTransactionAsync:start");
      await cb();
      callOrder.push("withTransactionAsync:end");
    }),
  };
}

describe("rebuildObjectivesTableIfLegacyCheckExists", () => {
  it("no hace nada si la tabla no tiene CHECK legado (no-op idempotente)", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getFirstAsync.mockResolvedValue({
      sql: "CREATE TABLE financial_objectives (id INTEGER PRIMARY KEY, type TEXT NOT NULL)",
    });

    await rebuildObjectivesTableIfLegacyCheckExists(fakeDb as unknown as SQLite.SQLiteDatabase);

    expect(fakeDb.execAsync).not.toHaveBeenCalled();
    expect(fakeDb.withTransactionAsync).not.toHaveBeenCalled();
  });

  it("no hace nada si sqlite_master no devuelve fila para la tabla", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getFirstAsync.mockResolvedValue(null);

    await rebuildObjectivesTableIfLegacyCheckExists(fakeDb as unknown as SQLite.SQLiteDatabase);

    expect(fakeDb.execAsync).not.toHaveBeenCalled();
    expect(fakeDb.withTransactionAsync).not.toHaveBeenCalled();
  });

  it("reconstruye la tabla cuando detecta el CHECK legado, con PRAGMA OFF antes y ON después", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getFirstAsync.mockResolvedValue({
      sql: "CREATE TABLE financial_objectives (id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('loan','savings','goal')))",
    });

    await rebuildObjectivesTableIfLegacyCheckExists(fakeDb as unknown as SQLite.SQLiteDatabase);

    expect(fakeDb.withTransactionAsync).toHaveBeenCalledTimes(1);

    const offIndex = callOrder.findIndex((c) => c.includes("PRAGMA foreign_keys = OFF"));
    const txStartIndex = callOrder.indexOf("withTransactionAsync:start");
    const txEndIndex = callOrder.indexOf("withTransactionAsync:end");
    const onIndex = callOrder.findIndex((c) => c.includes("PRAGMA foreign_keys = ON"));

    expect(offIndex).toBeGreaterThanOrEqual(0);
    expect(txStartIndex).toBeGreaterThan(offIndex);
    expect(txEndIndex).toBeGreaterThan(txStartIndex);
    expect(onIndex).toBeGreaterThan(txEndIndex);

    // Dentro de la transacción se ejecuta el bloque de reconstrucción
    // (CREATE/INSERT/DROP/RENAME) via un único execAsync.
    const execCallsDuringTx = fakeDb.execAsync.mock.calls.filter(([sql]: [string]) =>
      sql.includes("financial_objectives_new"),
    );
    expect(execCallsDuringTx.length).toBe(1);
  });

  it("restaura PRAGMA foreign_keys = ON y propaga el error si la reconstrucción falla a mitad de camino", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getFirstAsync.mockResolvedValue({
      sql: "CREATE TABLE financial_objectives (id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('loan','savings','goal')))",
    });

    const failure = new Error("INSERT INTO ... SELECT falló a mitad de camino");
    fakeDb.withTransactionAsync.mockImplementation(async (cb: () => Promise<void>) => {
      callOrder.push("withTransactionAsync:start");
      // Simula que el propio callback (CREATE/INSERT/DROP/RENAME) rechaza.
      void cb;
      throw failure;
    });

    await expect(
      rebuildObjectivesTableIfLegacyCheckExists(fakeDb as unknown as SQLite.SQLiteDatabase),
    ).rejects.toThrow(failure);

    const offIndex = callOrder.findIndex((c) => c.includes("PRAGMA foreign_keys = OFF"));
    const onIndex = callOrder.findIndex((c) => c.includes("PRAGMA foreign_keys = ON"));
    expect(offIndex).toBeGreaterThanOrEqual(0);
    expect(onIndex).toBeGreaterThan(offIndex);
  });
});

describe("migrateObjectivesTable", () => {
  it("no ejecuta ningún ALTER TABLE si la columna ya existe", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getAllAsync.mockResolvedValue([
      { name: "id" },
      { name: "months_of_expenses_covered" },
    ]);

    await migrateObjectivesTable(fakeDb as unknown as SQLite.SQLiteDatabase);

    expect(fakeDb.execAsync).not.toHaveBeenCalled();
  });

  it("ejecuta ALTER TABLE ADD COLUMN months_of_expenses_covered REAL si la columna falta", async () => {
    const callOrder: string[] = [];
    const fakeDb = createFakeDb(callOrder);
    fakeDb.getAllAsync.mockResolvedValue([{ name: "id" }]);

    await migrateObjectivesTable(fakeDb as unknown as SQLite.SQLiteDatabase);

    expect(fakeDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE financial_objectives ADD COLUMN months_of_expenses_covered REAL",
    );
  });
});
