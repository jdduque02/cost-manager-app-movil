/**
 * Prove-It de ids offline contra un SQLite REAL en memoria (`node:sqlite`,
 * incluido en Node 24 — sin dependencias nuevas). El mock de `getDatabase`
 * que usan las otras suites no puede reproducir choques de PRIMARY KEY ni
 * `INSERT OR REPLACE`, que son justo los bugs que cubre este archivo:
 * - una fila creada offline no puede chocar con un id del servidor;
 * - al sincronizar, las referencias (cuenta/meta/empresa) a ids locales se remapean;
 * - update/delete nunca encolan un id local;
 * - la migración de bases de dev existentes renumera filas pendientes a negativo;
 * - `account_number` se guarda enmascarado; logout borra datos y cola.
 */
import { DatabaseSync } from "node:sqlite";
import * as SQLite from "expo-sqlite";
import { closeDatabase, getDatabase } from "../database.service";
import {
  createLocalBankAccount,
  createLocalCompany,
  createLocalObjective,
  createLocalTransaction,
  deleteLocalTransaction,
  getLocalTransactions,
  getPendingOperations,
  markEntitySynced,
  saveBankAccounts,
  saveCategories,
  saveTransactions,
  updateLocalTransaction,
  wipeLocalUserData,
} from "../local.repository";
import type { TransactionRecordResponse } from "@/types/transaction.types";

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

beforeEach(async () => {
  await closeDatabase();
  db = makeDb();
  openDatabaseAsync.mockResolvedValue(db);
});

const USER = 7;
const txDto = { type: "expense" as const, amount: 1000, transaction_date: "2026-09-01" };

function serverTx(id: number): TransactionRecordResponse {
  return {
    id,
    user_id: USER,
    category_id: null,
    subcategory_id: null,
    account_id: null,
    type: "expense",
    amount: 5,
    currency: "COP",
    is_fixed: false,
    description: "del servidor",
    transaction_date: "2026-09-02",
    created_at: "2026-09-02",
    updated_at: "2026-09-02",
  } as TransactionRecordResponse;
}

async function localIdOf(table: string, id: number): Promise<string> {
  const row = db.raw.prepare(`SELECT local_id FROM ${table} WHERE id = ?`).get(id) as {
    local_id: string;
  };
  return row.local_id;
}

describe("ids locales negativos", () => {
  it("una fila creada offline recibe id negativo y un fetch del servidor no la pisa", async () => {
    const local = await createLocalTransaction(USER, txDto);
    expect(local.id).toBeLessThan(0);

    // El servidor devuelve su propia transacción con id 1 (el mismo id que
    // SQLite habría autoasignado a la fila local con autoincrement positivo).
    await saveTransactions([serverTx(1), serverTx(Math.abs(local.id))]);

    const rows = await getLocalTransactions(USER);
    expect(rows.find((r) => r.id === local.id)?.is_pending_sync).toBe(true);
    expect(rows).toHaveLength(3);
  });

  it("ids locales consecutivos no se repiten", async () => {
    const a = await createLocalTransaction(USER, txDto);
    const b = await createLocalTransaction(USER, txDto);
    expect(b.id).toBeLessThan(a.id);
  });
});

describe("markEntitySynced remapea referencias a ids locales", () => {
  it("cuenta, meta y empresa: actualiza la fila de la transacción y el payload del CREATE pendiente", async () => {
    const acc = await createLocalBankAccount(USER, {
      bank_name: "B",
      account_type: "ahorros",
      account_number: "1234567890",
      balance: 0,
    });
    const obj = await createLocalObjective(USER, { name: "Meta", type: "goal" });
    const comp = await createLocalCompany(USER, { name: "Empresa" });
    const tx = await createLocalTransaction(USER, {
      ...txDto,
      account_id: acc.id,
      objective_id: obj.id,
      company_id: comp.id,
    });

    await markEntitySynced("bank_accounts", await localIdOf("bank_accounts", acc.id), 500);
    await markEntitySynced("financial_objectives", await localIdOf("financial_objectives", obj.id), 600);
    await markEntitySynced("companies", await localIdOf("companies", comp.id), 700);

    const row = (await getLocalTransactions(USER)).find((r) => r.id === tx.id)!;
    expect(row.account_id).toBe(500);
    expect(row.objective_id).toBe(600);
    expect(row.company_id).toBe(700);

    const txCreate = (await getPendingOperations()).find(
      (op) => op.entity === "transactions" && op.operation === "CREATE",
    )!;
    expect(txCreate.payload).toMatchObject({ account_id: 500, objective_id: 600, company_id: 700 });
  });

  it("no falla si el servidor ya estaba cacheado con ese id (refetch antes de marcar)", async () => {
    const acc = await createLocalBankAccount(USER, {
      bank_name: "B",
      account_type: "ahorros",
      account_number: "1234567890",
      balance: 0,
    });
    const localId = await localIdOf("bank_accounts", acc.id);
    await saveBankAccounts([
      {
        id: 500,
        user_id: USER,
        bank_name: "B",
        account_type: "ahorros",
        masked_account_number: "****7890",
        display_balance: "0",
        currency: "COP",
        is_primary: false,
        created_at: "x",
        updated_at: "x",
      },
    ]);

    await expect(markEntitySynced("bank_accounts", localId, 500)).resolves.toBeUndefined();
    const rows = db.raw.prepare("SELECT id FROM bank_accounts").all();
    expect(rows).toEqual([{ id: 500 }]);
  });
});

describe("update/delete nunca encolan un id local", () => {
  it("update de una fila local sin CREATE pendiente no encola UPDATE con id negativo", async () => {
    const tx = await createLocalTransaction(USER, txDto);
    db.raw.exec("DELETE FROM pending_operations");

    await updateLocalTransaction(USER, tx.id, { amount: 99 });

    expect(await getPendingOperations()).toEqual([]);
  });

  it("delete de una fila local sin CREATE pendiente la borra sin encolar DELETE", async () => {
    const tx = await createLocalTransaction(USER, txDto);
    db.raw.exec("DELETE FROM pending_operations");

    await deleteLocalTransaction(USER, tx.id);

    expect(await getPendingOperations()).toEqual([]);
    expect(await getLocalTransactions(USER)).toEqual([]);
  });
});

describe("migración de bases de dev existentes", () => {
  it("renumera a negativo las filas pendientes con id positivo y remapea referencias", async () => {
    // Base "vieja": esquema actual + filas locales con id autoincrement positivo.
    await getDatabase();
    db.raw.exec(`
      INSERT INTO bank_accounts (id, local_id, user_id, bank_name, account_type, account_number, is_pending_sync)
        VALUES (3, 'local_acc', ${USER}, 'B', 'ahorros', '9876543210', 1);
      INSERT INTO bank_accounts (id, local_id, user_id, bank_name, account_type, is_pending_sync)
        VALUES (40, '40', ${USER}, 'Servidor', 'ahorros', 0);
      INSERT INTO transactions (id, local_id, user_id, account_id, type, amount, transaction_date, is_pending_sync)
        VALUES (5, 'local_tx', ${USER}, 3, 'expense', 10, '2026-09-01', 1);
      INSERT INTO pending_operations (local_id, entity, operation, payload)
        VALUES ('local_acc', 'bank_accounts', 'CREATE', '{"userId":${USER},"bank_name":"B"}'),
               ('local_tx', 'transactions', 'CREATE', '{"userId":${USER},"account_id":3,"amount":10}');
    `);

    await closeDatabase();
    await getDatabase();

    const acc = db.raw.prepare("SELECT id, account_number FROM bank_accounts WHERE local_id = 'local_acc'").get() as {
      id: number;
      account_number: string;
    };
    expect(acc.id).toBeLessThan(0);
    expect(acc.account_number).toBe("****3210");
    const tx = db.raw.prepare("SELECT id, account_id FROM transactions WHERE local_id = 'local_tx'").get() as {
      id: number;
      account_id: number;
    };
    expect(tx.id).toBeLessThan(0);
    expect(tx.account_id).toBe(acc.id);
    const txOp = (await getPendingOperations()).find((op) => op.localId === "local_tx")!;
    expect(txOp.payload.account_id).toBe(acc.id);
    // La fila ya sincronizada no se toca.
    expect(db.raw.prepare("SELECT id FROM bank_accounts WHERE local_id = '40'").get()).toEqual({ id: 40 });
  });
});

describe("datos sensibles en SQLite", () => {
  it("guarda account_number enmascarado en la tabla (el payload de la cola conserva el real para el sync)", async () => {
    await createLocalBankAccount(USER, {
      bank_name: "B",
      account_type: "ahorros",
      account_number: "1234567890",
      balance: 0,
    });
    const row = db.raw.prepare("SELECT account_number FROM bank_accounts").get();
    expect(row).toEqual({ account_number: "****7890" });
    const [op] = await getPendingOperations();
    expect(op.payload.account_number).toBe("1234567890");
  });

  it("wipeLocalUserData borra datos del usuario y la cola, pero conserva el catálogo de categorías", async () => {
    await saveCategories([
      {
        id: 1,
        name: "Comida",
        icon_key: null,
        color_hex: null,
        group_type: "expense",
        sort_order: 0,
        is_active: true,
        created_at: "x",
      },
    ]);
    await createLocalTransaction(USER, txDto);
    await saveTransactions([serverTx(9)]);

    await wipeLocalUserData();

    expect(await getLocalTransactions(USER)).toEqual([]);
    expect(await getPendingOperations()).toEqual([]);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM categories").get()).toEqual({ n: 1 });
  });
});
