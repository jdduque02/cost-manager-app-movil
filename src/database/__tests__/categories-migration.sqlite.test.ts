/**
 * Migración de `categories.is_system` contra SQLite REAL (`node:sqlite`).
 * Bug: en la 1.5.0 el usuario podía crear categorías propias; al añadir la columna
 * con DEFAULT 1 quedaban como "sistema" y `clearLocalCategories`/`wipeLocalUserData`
 * (solo tocan `is_system = 0`) no las limpiaban: otro usuario sin conexión las veía.
 */
import { DatabaseSync } from "node:sqlite";
import * as SQLite from "expo-sqlite";
import { closeDatabase, getDatabase } from "../database.service";
import {
  clearLocalCategories,
  getLocalCategories,
  saveCategories,
  wipeLocalUserData,
} from "../local.repository";
import type { CategoryResponse } from "@/types/catalog.types";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("../secure-user-cache", () => ({}));

type Params = (string | number | null)[];

function makeDb(raw = new DatabaseSync(":memory:")) {
  return {
    raw,
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
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

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;
let db: ReturnType<typeof makeDb>;

/** Esquema de la 1.5.0: `categories` SIN `is_system`. 1 y 2 son del catálogo; 100-104 propias de A. */
function seedV150() {
  db.raw.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, icon_key TEXT, color_hex TEXT,
      group_type TEXT NOT NULL, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT,
      synced_at TEXT DEFAULT (datetime('now')));
    INSERT INTO categories (id, name, group_type) VALUES
      (1,'Sistema 1','expense'),(2,'Sistema 2','income'),
      (100,'Propia libre','expense'),(101,'Propia con tx','expense'),
      (102,'Propia con sub','expense'),(103,'Propia en cola','expense'),
      (104,'Propia de empresa','expense');
    CREATE TABLE transactions (id INTEGER PRIMARY KEY, local_id TEXT UNIQUE, user_id INTEGER NOT NULL,
      category_id INTEGER, subcategory_id INTEGER, account_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'COP', is_fixed INTEGER DEFAULT 0, description TEXT,
      transaction_date TEXT NOT NULL, created_at TEXT, updated_at TEXT, is_pending_sync INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id));
    CREATE TABLE subcategories (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, category_id INTEGER NOT NULL,
      name TEXT NOT NULL, icon_key TEXT, color_hex TEXT, created_at TEXT, updated_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id));
    CREATE TABLE companies (id INTEGER PRIMARY KEY, local_id TEXT UNIQUE, user_id INTEGER NOT NULL,
      name TEXT NOT NULL, default_category_id INTEGER, created_at TEXT, updated_at TEXT, is_pending_sync INTEGER DEFAULT 0);
    CREATE TABLE pending_operations (id INTEGER PRIMARY KEY AUTOINCREMENT, local_id TEXT NOT NULL,
      entity TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), retry_count INTEGER DEFAULT 0);
    INSERT INTO transactions (id, user_id, category_id, type, amount, transaction_date)
      VALUES (1, 7, 101, 'expense', 10, '2026-09-01');
    INSERT INTO subcategories (id, user_id, category_id, name) VALUES (1, 7, 102, 'Sub');
    INSERT INTO companies (id, user_id, name, default_category_id) VALUES (1, 7, 'Emp', 104);
    INSERT INTO pending_operations (local_id, entity, operation, payload)
      VALUES ('x', 'transaction', 'CREATE', '{"category_id":103,"amount":5}'),
             ('y', 'transaction', 'CREATE', 'no-es-json');
  `);
}

const ids = () =>
  (db.raw.prepare("SELECT id FROM categories ORDER BY id").all() as { id: number }[]).map(
    (r) => r.id,
  );

const category = (id: number, is_system = true) =>
  ({
    id,
    name: `Cat ${id}`,
    icon_key: null,
    color_hex: null,
    group_type: "expense",
    sort_order: 0,
    is_active: true,
    is_system,
    created_at: "",
  }) as CategoryResponse;

beforeEach(async () => {
  await closeDatabase();
  db = makeDb();
  openDatabaseAsync.mockResolvedValue(db);
});

describe("migrateCategoriesTable (1.5.0 -> is_system)", () => {
  it("al añadir la columna borra las no referenciadas y conserva las referenciadas", async () => {
    seedV150();
    await getDatabase();
    // 1, 2 y 100 no están referenciadas: la caché se repuebla en la primera sync en línea.
    expect(ids()).toEqual([101, 102, 103, 104]);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM pending_operations").get()).toEqual({ n: 2 });
  });

  it("es idempotente: abrir de nuevo no borra nada más", async () => {
    seedV150();
    await getDatabase();
    await saveCategories([category(1), category(100, false)]);
    const before = ids();
    await closeDatabase();
    await getDatabase();
    expect(ids()).toEqual(before);
  });

  it("no toca instalaciones nuevas (la columna ya existe)", async () => {
    await getDatabase();
    await saveCategories([category(1), category(2)]);
    await closeDatabase();
    await getDatabase();
    expect(ids()).toEqual([1, 2]);
  });

  it("cambio de cuenta A->B sin conexión: B no ve las propias de A que estaban sin referenciar", async () => {
    seedV150();
    await getDatabase();
    // A abre en línea tras migrar: el snapshot trae el catálogo y una propia nueva.
    await saveCategories([category(1), category(2), category(110, false)], true);
    await clearLocalCategories(); // logout de A
    const visible = (await getLocalCategories()).map((c) => c.id);
    expect(visible).not.toContain(100);
    expect(visible).not.toContain(110);
    expect(visible).toEqual(expect.arrayContaining([1, 2]));
  });

  it("wipeLocalUserData con una propia referenciada por una transacción respeta el orden de FK", async () => {
    await getDatabase();
    await saveCategories([category(1), category(120, false)]);
    db.raw.exec(
      "INSERT INTO transactions (id, user_id, category_id, type, amount, transaction_date) VALUES (9, 7, 120, 'expense', 1, '2026-09-01')",
    );
    await expect(wipeLocalUserData()).resolves.toBeUndefined();
    expect(ids()).toEqual([1]);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM transactions").get()).toEqual({ n: 0 });
  });
});
