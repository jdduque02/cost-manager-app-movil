/**
 * Tests unitarios para las funciones exportadas de src/database/database.service.ts
 * que no dependen de getDatabase()/loadSQLite() (import("expo-sqlite") literal no
 * es transformable por Jest sin tocar babel/jest config). Se testean directamente
 * rebuildObjectivesTableIfLegacyCheckExists y migrateObjectivesTable pasándoles un
 * `db` fake, sin pasar por el singleton real.
 */
import { DatabaseSync } from "node:sqlite";
import {
  closeDatabase,
  getDatabase,
  rebuildObjectivesTableIfLegacyCheckExists,
  migrateObjectivesTable,
} from "../database.service";
import * as SQLite from "expo-sqlite";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

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

describe("migración de arranque contra SQLite real (recurrentes)", () => {
  type Params = (string | number | null)[];
  // Adaptador mínimo de `node:sqlite` a la API async de expo-sqlite.
  function realDb(raw: DatabaseSync) {
    return {
      execAsync: async (sql: string) => void raw.exec(sql),
      runAsync: async (sql: string, params: Params = []) => raw.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: Params = []) => raw.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: Params = []) =>
        raw.prepare(sql).get(...params) ?? null,
      withTransactionAsync: async (task: () => Promise<void>) => {
        raw.exec("BEGIN");
        try {
          await task();
          raw.exec("COMMIT");
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        }
      },
      closeAsync: async () => {},
    };
  }

  it("migrar dos veces no falla y conserva las filas", async () => {
    const raw = new DatabaseSync(":memory:");
    // Instalación previa: `transactions` sin las columnas de recurrentes.
    raw.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY, local_id TEXT UNIQUE, user_id INTEGER NOT NULL,
        category_id INTEGER, subcategory_id INTEGER, account_id INTEGER,
        type TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'COP',
        is_fixed INTEGER DEFAULT 0, description TEXT, transaction_date TEXT NOT NULL,
        created_at TEXT, updated_at TEXT, is_pending_sync INTEGER DEFAULT 0
      );
      INSERT INTO transactions (id, local_id, user_id, type, amount, transaction_date)
        VALUES (5, '5', 7, 'expense', 1000, '2026-10-01');
    `);
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(realDb(raw));

    for (let i = 0; i < 2; i++) {
      await closeDatabase();
      await getDatabase();
    }

    const columns = (raw.prepare("PRAGMA table_info(transactions)").all() as { name: string }[])
      .map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(["recurring_id", "needs_validation"]));
    expect(raw.prepare("SELECT id, amount, recurring_id, needs_validation FROM transactions").all())
      .toEqual([{ id: 5, amount: 1000, recurring_id: null, needs_validation: 0 }]);
    expect(
      raw.prepare("SELECT name FROM sqlite_master WHERE name = 'recurring_transactions'").get(),
    ).toBeDefined();
    await closeDatabase();
  });
});
