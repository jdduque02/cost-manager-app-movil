/**
 * Prove-It de la poda del caché contra SQLite REAL en memoria (`node:sqlite`).
 * Bug: `saveX` hacía INSERT OR REPLACE sin podar, así que lo borrado desde otro
 * dispositivo (o la web) quedaba como fantasma en el caché offline. Tras un
 * fetch COMPLETO se borran las filas del snapshot previo (`getCachedIds`) que el
 * servidor ya no devolvió, salvo las creadas offline, las que tienen operaciones
 * en la cola (activas o atascadas) y las que aparecieron durante el GET.
 */
import { DatabaseSync } from "node:sqlite";
import * as SQLite from "expo-sqlite";
import { closeDatabase } from "../database.service";
import {
  createLocalBankAccount,
  createLocalCompany,
  getCachedIds,
  getLocalBankAccounts,
  getLocalCompanies,
  getLocalFinancialAssets,
  getLocalFinancialLiabilities,
  getLocalSubcategories,
  getPendingOperations,
  markEntitySynced,
  markOperationFailed,
  saveBankAccounts,
  saveCategories,
  saveCompanies,
  saveFinancialAssets,
  saveFinancialLiabilities,
  saveSubcategories,
  updateLocalBankAccount,
} from "../local.repository";
import { MAX_RETRIES } from "../local-refs";
import type { BankAccountResponse, FinancialAssetResponse, FinancialLiabilityResponse } from "@/types/banking.types";
import type { CategoryResponse, SubcategoryResponse } from "@/types/catalog.types";
import type { EmpresaResponse } from "@/types/empresa.types";

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
const OTHER_USER = 8;
const offlineAccountDto = {
  bank_name: "Offline",
  account_type: "ahorros",
  account_number: "123456",
  balance: 0,
} as never;

const account = (id: number, user_id = USER) =>
  ({
    id,
    user_id,
    bank_name: `Banco ${id}`,
    masked_account_number: "****",
    account_type: "ahorros",
    display_balance: "0",
    currency: "COP",
    is_primary: false,
    created_at: "2026-09-01",
    updated_at: "2026-09-01",
  }) as BankAccountResponse;

const company = (id: number) =>
  ({ id, user_id: USER, name: `Empresa ${id}`, default_category_id: null, created_at: "", updated_at: "" }) as EmpresaResponse;

const category = (id: number) =>
  ({ id, name: `Cat ${id}`, icon_key: null, color_hex: null, group_type: "expense", sort_order: 0, is_active: true, created_at: "" }) as CategoryResponse;

const sub = (id: number, category_id = 1) =>
  ({ id, user_id: USER, category_id, name: `Sub ${id}`, icon_key: null, color_hex: null, created_at: "", updated_at: "" }) as SubcategoryResponse;

const asset = (id: number) =>
  ({ id, user_id: USER, asset_type: "acciones", name: `Activo ${id}`, current_value: 1, current_yield: null, currency: "COP", created_at: "", updated_at: "" }) as FinancialAssetResponse;

const liability = (id: number) =>
  ({ id, user_id: USER, liability_type: "credito_consumo", name: `Pasivo ${id}`, current_balance: 1, currency: "COP", created_at: "", updated_at: "" }) as FinancialLiabilityResponse;

const ids = (rows: { id: number }[]) => rows.map((r) => r.id).sort((a, b) => a - b);

describe("poda del caché tras un fetch completo", () => {
  it("cuentas: borra las que el servidor ya no devolvió y respeta cola, offline y otros usuarios", async () => {
    await saveBankAccounts([account(1), account(2), account(3), account(4), account(9, OTHER_USER)]);
    const offline = await createLocalBankAccount(USER, offlineAccountDto);
    // 3: UPDATE activo en la cola. 4: UPDATE atascado (rechazo 4xx).
    await updateLocalBankAccount(USER, 3, { bank_name: "Editada offline" });
    await updateLocalBankAccount(USER, 4, { bank_name: "Atascada" });
    const stuck = (await getPendingOperations()).find((op) => op.payload.id === 4)!;
    await markOperationFailed(stuck.id, "HTTP 422", MAX_RETRIES);

    // El servidor solo devuelve la cuenta 1 (2, 3 y 4 se borraron desde la web).
    const before = await getCachedIds("bank_accounts", USER);
    await saveBankAccounts([account(1)], before);

    expect(ids(await getLocalBankAccounts(USER))).toEqual([offline.id, 1, 3, 4]);
    expect(ids(await getLocalBankAccounts(OTHER_USER))).toEqual([9]);
  });

  it("una cuenta que sincroniza mientras el GET viaja no se poda con la respuesta vieja", async () => {
    await createLocalBankAccount(USER, offlineAccountDto);
    const before = await getCachedIds("bank_accounts", USER); // snapshot antes del GET
    const create = (await getPendingOperations())[0];
    await markEntitySynced("bank_accounts", create.localId, 70); // el sync termina en paralelo

    await saveBankAccounts([], before); // la respuesta del GET no traía la 70

    expect(ids(await getLocalBankAccounts(USER))).toEqual([70]);
  });

  it("sin snapshot (lote parcial: una fila tras crear/editar) no poda nada", async () => {
    await saveBankAccounts([account(1), account(2)]);
    await saveBankAccounts([account(1)]);
    expect(ids(await getLocalBankAccounts(USER))).toEqual([1, 2]);
  });

  it("una lista completa vacía poda todas las filas del servidor de ese usuario", async () => {
    await saveBankAccounts([account(1), account(2)]);
    await saveBankAccounts([], await getCachedIds("bank_accounts", USER));
    expect(await getLocalBankAccounts(USER)).toEqual([]);
  });

  it("si la poda falla, el upsert de datos frescos igual queda guardado", async () => {
    await saveBankAccounts([account(1), account(2)]);
    const before = await getCachedIds("bank_accounts", USER);
    const run = db.runAsync;
    db.runAsync = async (sql: string, params?: Params) => {
      if (sql.startsWith("DELETE FROM bank_accounts")) throw new Error("SQLITE_BUSY");
      return run(sql, params);
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await saveBankAccounts([{ ...account(1), bank_name: "Renombrada" }], before);

    const rows = await getLocalBankAccounts(USER);
    expect(rows.find((r) => r.id === 1)?.bank_name).toBe("Renombrada");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("empresas: poda las borradas y conserva la creada offline", async () => {
    await saveCompanies([company(1), company(2)]);
    const offline = await createLocalCompany(USER, { name: "Nueva" });
    await saveCompanies([company(2)], await getCachedIds("companies", USER));
    expect(ids(await getLocalCompanies(USER))).toEqual([offline.id, 2]);
  });

  it("subcategorías filtradas por categoría: solo poda dentro de esa categoría", async () => {
    await saveCategories([category(1), category(2)]);
    await saveSubcategories([sub(1, 1), sub(2, 1), sub(3, 2)]);

    await saveSubcategories([sub(2, 1)], await getCachedIds("subcategories", USER, 1));

    expect(ids(await getLocalSubcategories(USER))).toEqual([2, 3]);
  });

  it("activos y pasivos: poda por usuario tras la lista completa", async () => {
    await saveFinancialAssets([asset(1), asset(2)]);
    await saveFinancialLiabilities([liability(1), liability(2)]);

    await saveFinancialAssets([asset(1)], await getCachedIds("financial_assets", USER));
    await saveFinancialLiabilities([], await getCachedIds("financial_liabilities", USER));

    expect(ids(await getLocalFinancialAssets(USER))).toEqual([1]);
    expect(await getLocalFinancialLiabilities(USER)).toEqual([]);
  });
});
