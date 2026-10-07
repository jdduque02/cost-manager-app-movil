/**
 * Recurrentes contra SQLite REAL en memoria (`node:sqlite`): columnas nuevas
 * de `transactions` y caché de solo lectura `recurring_transactions` (R8.4).
 */
import { DatabaseSync } from "node:sqlite";
import * as SQLite from "expo-sqlite";
import { closeDatabase } from "../database.service";
import {
  getLocalRecurringTransactions,
  getLocalTransactions,
  getPendingOperations,
  saveRecurringTransactions,
  saveTransactions,
  wipeLocalUserData,
} from "../local.repository";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type { RecurringTransaction } from "@/types/recurring.types";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("../secure-user-cache", () => ({}));

type Params = (string | number | null)[];

beforeEach(async () => {
  await closeDatabase();
  const raw = new DatabaseSync(":memory:");
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue({
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
  });
});

const USER = 7;
const rule = (id: number) => ({ id, name: `Regla ${id}`, amount: 1000 }) as RecurringTransaction;

it("guarda y lee recurring_id y needs_validation de las transacciones del servidor", async () => {
  await saveTransactions([
    {
      id: 1,
      user_id: USER,
      type: "expense",
      amount: 5,
      currency: "COP",
      is_fixed: false,
      transaction_date: "2026-10-01",
      recurring_id: 3,
      needs_validation: true,
    } as TransactionRecordResponse,
  ]);
  const [tx] = await getLocalTransactions(USER);
  expect(tx).toMatchObject({ recurring_id: 3, needs_validation: true });
});

it("el caché conserva la moneda propia del ingreso recurrente, sin convertir el monto", async () => {
  const usd = { ...rule(1), type: "income", currency: "USD", amount: 1000 } as RecurringTransaction;
  await saveRecurringTransactions(USER, [usd]);
  expect(await getLocalRecurringTransactions(USER)).toEqual([usd]);
  expect(await getPendingOperations()).toEqual([]);
});

it("el caché de recurrentes se reemplaza entero, no encola y se borra al cerrar sesión", async () => {
  await saveRecurringTransactions(USER, [rule(1), rule(2)]);
  await saveRecurringTransactions(USER, [rule(2)]);
  expect(await getLocalRecurringTransactions(USER)).toEqual([rule(2)]);
  expect(await getPendingOperations()).toEqual([]);

  await wipeLocalUserData();
  expect(await getLocalRecurringTransactions(USER)).toEqual([]);
});
