import { getDatabase } from "./database.service";
import {
  cacheUserProfileSecurely,
  getSecurelyCachedUserProfile,
  clearSecurelyCachedUserProfile,
} from "./secure-user-cache";
import type { UserResponse } from "@/types/user.types";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
} from "@/types/transaction.types";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from "@/types/banking.types";
import type {
  FinancialObjectiveResponse,
  CreateFinancialObjectiveDto,
  UpdateFinancialObjectiveDto,
} from "@/types/objective.types";
import type {
  CategoryResponse,
  SubcategoryResponse,
} from "@/types/catalog.types";

// ─── Utilidad ───────────────────────────────────────────────────────────────

/**
 * Genera un ID local temporal (solo para hacer match con la fila real una vez
 * que el servidor asigna su id — no es un secreto ni un token, así que no
 * necesita ser criptográficamente seguro). No usa `crypto.getRandomValues`:
 * Hermes/React Native no expone `crypto` como global sin un polyfill nativo
 * (`expo-crypto` / `react-native-get-random-values`) que este proyecto no
 * tiene instalado — llamarlo tronaba con "Property 'crypto' doesn't exist"
 * en cualquier creación offline (transacciones, cuentas, objetivos).
 */
function generateLocalId(): string {
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `local_${Date.now().toString(16)}${rand()}${rand()}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Convierte `undefined` en `null` para parámetros de SQLite.
 * expo-sqlite crashea el binder nativo (NullPointerException en
 * NativeDatabase.prepareAsync) si recibe `undefined` — solo acepta `null`.
 * Se aplica a todo campo que venga de una respuesta del backend, ya que su
 * forma real no siempre coincide exactamente con el tipo TS declarado.
 */
function nz<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value;
}

/** Enmascara un número de cuenta local para mostrar solo los últimos 4 dígitos. */
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
}

// ─── Usuario ─────────────────────────────────────────────────────────────────
//
// El "último perfil de usuario conocido" (username, email, nombre — PII) se
// guarda en caché ENCRIPTADA vía `secure-user-cache.ts` (expo-secure-store),
// no en SQLite: es la pieza que le permite a `useAuthStore` reconocer al
// usuario y arrancar en modo offline sin exponer sus datos en texto plano en
// el archivo .db del dispositivo. Ver `secure-user-cache.ts` para el detalle.

export async function cacheUser(user: UserResponse): Promise<void> {
  await cacheUserProfileSecurely(user);
}

export async function getCachedUser(): Promise<UserResponse | null> {
  return getSecurelyCachedUserProfile();
}

export async function clearCachedUser(): Promise<void> {
  await clearSecurelyCachedUserProfile();
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function saveCategories(
  categories: CategoryResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const cat of categories) {
    await db.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, icon_key, color_hex, group_type, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nz(cat.id),
        nz(cat.name),
        nz(cat.icon_key),
        nz(cat.color_hex),
        nz(cat.group_type),
        nz(cat.sort_order) ?? 0,
        cat.is_active ? 1 : 0,
        nz(cat.created_at),
      ],
    );
  }
}

export async function getLocalCategories(): Promise<CategoryResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    icon_key: string | null;
    color_hex: string | null;
    group_type: string;
    sort_order: number;
    is_active: number;
    created_at: string;
  }>("SELECT * FROM categories");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon_key: r.icon_key,
    color_hex: r.color_hex,
    group_type: r.group_type as CategoryResponse["group_type"],
    sort_order: r.sort_order,
    is_active: r.is_active === 1,
    created_at: r.created_at,
  }));
}

export async function saveSubcategories(
  subs: SubcategoryResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const s of subs) {
    await db.runAsync(
      `INSERT OR REPLACE INTO subcategories (id, user_id, category_id, name, icon_key, color_hex, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nz(s.id),
        nz(s.user_id),
        nz(s.category_id),
        nz(s.name),
        nz(s.icon_key),
        nz(s.color_hex),
        nz(s.created_at),
        nz(s.updated_at),
      ],
    );
  }
}

export async function getLocalSubcategories(
  categoryId?: number,
): Promise<SubcategoryResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    user_id: number;
    category_id: number;
    name: string;
    icon_key: string | null;
    color_hex: string | null;
    created_at: string;
    updated_at: string;
  }>(
    categoryId
      ? "SELECT * FROM subcategories WHERE category_id = ?"
      : "SELECT * FROM subcategories",
    categoryId ? [categoryId] : [],
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    category_id: r.category_id,
    name: r.name,
    icon_key: r.icon_key,
    color_hex: r.color_hex,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

// ─── Cuentas bancarias ────────────────────────────────────────────────────────

export async function saveBankAccounts(
  accounts: BankAccountResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const a of accounts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO bank_accounts
        (id, local_id, user_id, bank_name, account_type, balance, currency, is_primary, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        nz(a.id),
        String(a.id),
        nz(a.user_id),
        nz(a.bank_name),
        nz(a.account_type),
        Number(a.display_balance ?? 0),
        nz(a.currency),
        a.is_primary ? 1 : 0,
        nz(a.created_at),
        nz(a.updated_at),
      ],
    );
  }
}

export async function getLocalBankAccounts(
  userId: number,
): Promise<BankAccountResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    local_id: string;
    user_id: number;
    bank_name: string;
    account_type: string;
    account_number: string | null;
    balance: number;
    currency: string;
    is_primary: number;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM bank_accounts WHERE user_id = ?", [userId]);
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    bank_name: r.bank_name,
    account_type: r.account_type as BankAccountResponse["account_type"],
    masked_account_number: r.account_number
      ? maskAccountNumber(r.account_number)
      : "****",
    display_balance: String(r.balance),
    currency: r.currency,
    is_primary: r.is_primary === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function createLocalBankAccount(
  userId: number,
  dto: CreateBankAccountDto,
): Promise<BankAccountResponse> {
  const db = await getDatabase();
  const localId = generateLocalId();
  const timestamp = now();
  await db.runAsync(
    `INSERT INTO bank_accounts (local_id, user_id, bank_name, account_type, account_number, balance, currency, is_primary, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      localId,
      userId,
      nz(dto.bank_name),
      nz(dto.account_type),
      nz(dto.account_number),
      nz(dto.balance) ?? 0,
      dto.currency ?? "COP",
      dto.is_primary ? 1 : 0,
      timestamp,
      timestamp,
    ],
  );
  const row = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM bank_accounts WHERE local_id = ?",
    [localId],
  );
  await enqueuePendingOperation(localId, "bank_accounts", "CREATE", {
    userId,
    ...dto,
    localId,
  });
  return {
    id: row!.id,
    user_id: userId,
    bank_name: dto.bank_name,
    account_type: dto.account_type,
    masked_account_number: maskAccountNumber(dto.account_number),
    display_balance: String(dto.balance),
    currency: dto.currency ?? "COP",
    is_primary: Boolean(dto.is_primary),
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function updateLocalBankAccount(
  userId: number,
  id: number,
  dto: UpdateBankAccountDto,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM bank_accounts WHERE id = ?",
    [id],
  );
  if (!row) return;

  const timestamp = now();
  await db.runAsync(
    `UPDATE bank_accounts SET
      bank_name = COALESCE(?, bank_name),
      account_type = COALESCE(?, account_type),
      account_number = COALESCE(?, account_number),
      balance = COALESCE(?, balance),
      currency = COALESCE(?, currency),
      is_primary = COALESCE(?, is_primary),
      updated_at = ?
     WHERE id = ?`,
    [
      nz(dto.bank_name),
      nz(dto.account_type),
      nz(dto.account_number),
      nz(dto.balance),
      nz(dto.currency),
      dto.is_primary === undefined ? null : dto.is_primary ? 1 : 0,
      timestamp,
      id,
    ],
  );
  await collapseOrEnqueueUpdate("bank_accounts", row.local_id, id, {
    userId,
    ...dto,
  });
}

/** Elimina sólo del caché local, sin tocar la cola de sincronización — usar cuando el borrado ya se confirmó con el servidor. */
export async function removeCachedBankAccount(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM bank_accounts WHERE id = ?", [id]);
}

export async function deleteLocalBankAccount(
  userId: number,
  id: number,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM bank_accounts WHERE id = ?",
    [id],
  );
  if (!row) return;
  await collapseOrEnqueueDelete("bank_accounts", row.local_id, { userId, id });
}

// ─── Transacciones ────────────────────────────────────────────────────────────

export async function saveTransactions(
  transactions: TransactionRecordResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const t of transactions) {
    await db.runAsync(
      `INSERT OR REPLACE INTO transactions
        (id, local_id, user_id, category_id, subcategory_id, account_id, type, amount, currency, is_fixed, description, transaction_date, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        nz(t.id),
        String(t.id),
        nz(t.user_id),
        nz(t.category_id),
        nz(t.subcategory_id),
        nz(t.account_id),
        nz(t.type),
        nz(t.amount) ?? 0,
        nz(t.currency),
        t.is_fixed ? 1 : 0,
        nz(t.description),
        nz(t.transaction_date),
        nz(t.created_at),
        nz(t.updated_at),
      ],
    );
  }
}

export async function getLocalTransactions(
  userId: number,
): Promise<TransactionRecordResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    local_id: string;
    user_id: number;
    category_id: number | null;
    subcategory_id: number | null;
    account_id: number | null;
    type: string;
    amount: number;
    currency: string;
    is_fixed: number;
    description: string | null;
    transaction_date: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC",
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    account_id: r.account_id,
    type: r.type as TransactionRecordResponse["type"],
    amount: r.amount,
    currency: r.currency,
    is_fixed: r.is_fixed === 1,
    description: r.description,
    transaction_date: r.transaction_date,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function createLocalTransaction(
  userId: number,
  dto: CreateTransactionRecordDto,
): Promise<TransactionRecordResponse> {
  const db = await getDatabase();
  const localId = generateLocalId();
  const timestamp = now();
  await db.runAsync(
    `INSERT INTO transactions
      (local_id, user_id, category_id, subcategory_id, account_id, type, amount, currency, is_fixed, description, transaction_date, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`,
    [
      localId,
      userId,
      dto.category_id ?? null,
      dto.subcategory_id ?? null,
      dto.account_id ?? null,
      dto.type,
      dto.amount,
      dto.currency ?? "COP",
      dto.description ?? null,
      dto.transaction_date ?? timestamp,
      timestamp,
      timestamp,
    ],
  );
  const row = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM transactions WHERE local_id = ?",
    [localId],
  );
  await enqueuePendingOperation(localId, "transactions", "CREATE", {
    userId,
    ...dto,
    localId,
  });
  return {
    id: row!.id,
    user_id: userId,
    category_id: dto.category_id ?? null,
    subcategory_id: dto.subcategory_id ?? null,
    account_id: dto.account_id ?? null,
    type: dto.type,
    amount: dto.amount,
    currency: dto.currency ?? "COP",
    is_fixed: false,
    description: dto.description ?? null,
    transaction_date: dto.transaction_date ?? timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function updateLocalTransaction(
  userId: number,
  id: number,
  dto: UpdateTransactionRecordDto,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM transactions WHERE id = ?",
    [id],
  );
  if (!row) return;

  const timestamp = now();
  await db.runAsync(
    `UPDATE transactions SET
      category_id = COALESCE(?, category_id),
      subcategory_id = COALESCE(?, subcategory_id),
      account_id = COALESCE(?, account_id),
      type = COALESCE(?, type),
      amount = COALESCE(?, amount),
      currency = COALESCE(?, currency),
      description = COALESCE(?, description),
      transaction_date = COALESCE(?, transaction_date),
      updated_at = ?
     WHERE id = ?`,
    [
      nz(dto.category_id),
      nz(dto.subcategory_id),
      nz(dto.account_id),
      nz(dto.type),
      nz(dto.amount),
      nz(dto.currency),
      nz(dto.description),
      nz(dto.transaction_date),
      timestamp,
      id,
    ],
  );
  await collapseOrEnqueueUpdate("transactions", row.local_id, id, {
    userId,
    ...dto,
  });
}

/** Elimina sólo del caché local, sin tocar la cola de sincronización — usar cuando el borrado ya se confirmó con el servidor. */
export async function removeCachedTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
}

export async function deleteLocalTransaction(
  userId: number,
  id: number,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM transactions WHERE id = ?",
    [id],
  );
  if (!row) return;
  await collapseOrEnqueueDelete("transactions", row.local_id, { userId, id });
}

// ─── Objetivos financieros ───────────────────────────────────────────────────

export async function saveObjectives(
  objectives: FinancialObjectiveResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const o of objectives) {
    await db.runAsync(
      `INSERT OR REPLACE INTO financial_objectives
        (id, local_id, user_id, name, type, target_amount, current_balance, start_date, end_date, is_completed, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        nz(o.id),
        String(o.id),
        nz(o.user_id),
        nz(o.name),
        nz(o.type),
        nz(o.target_amount),
        nz(o.current_balance) ?? 0,
        nz(o.start_date),
        nz(o.end_date),
        o.is_completed ? 1 : 0,
        nz(o.created_at),
        nz(o.updated_at),
      ],
    );
  }
}

export async function getLocalObjectives(
  userId: number,
): Promise<FinancialObjectiveResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    local_id: string;
    user_id: number;
    name: string;
    type: string;
    target_amount: number | null;
    current_balance: number;
    start_date: string | null;
    end_date: string | null;
    is_completed: number;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM financial_objectives WHERE user_id = ?", [userId]);
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    type: r.type as FinancialObjectiveResponse["type"],
    target_amount: r.target_amount,
    current_balance: r.current_balance,
    start_date: r.start_date,
    end_date: r.end_date,
    is_completed: r.is_completed === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function createLocalObjective(
  userId: number,
  dto: CreateFinancialObjectiveDto,
): Promise<FinancialObjectiveResponse> {
  const db = await getDatabase();
  const localId = generateLocalId();
  const timestamp = now();
  await db.runAsync(
    `INSERT INTO financial_objectives
      (local_id, user_id, name, type, target_amount, current_balance, start_date, end_date, is_completed, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`,
    [
      localId,
      userId,
      dto.name,
      dto.type,
      dto.target_amount ?? null,
      dto.current_balance ?? 0,
      dto.start_date ?? null,
      dto.end_date ?? null,
      timestamp,
      timestamp,
    ],
  );
  const row = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM financial_objectives WHERE local_id = ?",
    [localId],
  );
  await enqueuePendingOperation(localId, "financial_objectives", "CREATE", {
    userId,
    ...dto,
    localId,
  });
  return {
    id: row!.id,
    user_id: userId,
    name: dto.name,
    type: dto.type,
    target_amount: dto.target_amount ?? null,
    current_balance: dto.current_balance ?? 0,
    start_date: dto.start_date ?? null,
    end_date: dto.end_date ?? null,
    is_completed: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function updateLocalObjective(
  userId: number,
  id: number,
  dto: UpdateFinancialObjectiveDto,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM financial_objectives WHERE id = ?",
    [id],
  );
  if (!row) return;

  const timestamp = now();
  await db.runAsync(
    `UPDATE financial_objectives SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      target_amount = COALESCE(?, target_amount),
      current_balance = COALESCE(?, current_balance),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      updated_at = ?
     WHERE id = ?`,
    [
      nz(dto.name),
      nz(dto.type),
      nz(dto.target_amount),
      nz(dto.current_balance),
      nz(dto.start_date),
      nz(dto.end_date),
      timestamp,
      id,
    ],
  );
  await collapseOrEnqueueUpdate("financial_objectives", row.local_id, id, {
    userId,
    ...dto,
  });
}

/** Elimina sólo del caché local, sin tocar la cola de sincronización — usar cuando el borrado ya se confirmó con el servidor. */
export async function removeCachedObjective(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM financial_objectives WHERE id = ?", [id]);
}

export async function deleteLocalObjective(
  userId: number,
  id: number,
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_id: string }>(
    "SELECT local_id FROM financial_objectives WHERE id = ?",
    [id],
  );
  if (!row) return;
  await collapseOrEnqueueDelete("financial_objectives", row.local_id, {
    userId,
    id,
  });
}

// ─── Colapso de UPDATE/DELETE sobre un CREATE aún no sincronizado ────────────

/** Tablas permitidas para las operaciones de colapso (evita inyección de nombre de tabla). */
const ENTITY_TABLES = new Map<string, string>([
  ["transactions", "transactions"],
  ["bank_accounts", "bank_accounts"],
  ["financial_objectives", "financial_objectives"],
]);

async function findPendingCreateOperation(
  entity: string,
  localId: string,
): Promise<PendingOperation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: number;
    local_id: string;
    entity: string;
    operation: string;
    payload: string;
    retry_count: number;
  }>(
    "SELECT * FROM pending_operations WHERE entity = ? AND local_id = ? AND operation = 'CREATE'",
    [entity, localId],
  );
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    entity: row.entity,
    operation: row.operation as "CREATE" | "UPDATE" | "DELETE",
    payload: JSON.parse(row.payload),
    retryCount: row.retry_count,
  };
}

async function updatePendingOperationPayload(
  id: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE pending_operations SET payload = ? WHERE id = ?", [
    JSON.stringify(payload),
    id,
  ]);
}

/**
 * Si el registro todavía tiene un CREATE pendiente de sincronizar, mutar ese
 * payload en vez de encolar un UPDATE aparte (evita un UPDATE apuntando a un
 * id que todavía no existe en el servidor). Si ya sincronizó, encolar el
 * UPDATE normalmente.
 */
async function collapseOrEnqueueUpdate(
  entity: string,
  localId: string,
  id: number,
  changes: Record<string, unknown>,
): Promise<void> {
  const pendingCreate = await findPendingCreateOperation(entity, localId);
  if (pendingCreate) {
    // El CREATE aún no tiene un id de servidor — no se agrega `id` al payload,
    // sólo se mezclan los campos modificados sobre el DTO de creación original.
    await updatePendingOperationPayload(pendingCreate.id, {
      ...pendingCreate.payload,
      ...changes,
    });
  } else {
    await enqueuePendingOperation(localId, entity, "UPDATE", { ...changes, id });
  }
}

/**
 * Si el registro todavía tiene un CREATE pendiente de sincronizar, borrar
 * ambos localmente sin tocar la red (nunca llegó a existir en el servidor).
 * Si ya sincronizó, encolar el DELETE normalmente.
 */
async function collapseOrEnqueueDelete(
  entity: string,
  localId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const table = ENTITY_TABLES.get(entity);
  if (!table) return;
  const pendingCreate = await findPendingCreateOperation(entity, localId);
  if (pendingCreate) {
    // Nunca llegó a existir en el servidor: no hace falta el `payload`
    // (id/userId) porque no se enviará ninguna petición de red.
    await deletePendingOperation(pendingCreate.id);
  } else {
    await enqueuePendingOperation(localId, entity, "DELETE", payload);
  }
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM ${table} WHERE local_id = ?`, [localId]);
}

// ─── Cola de operaciones pendientes ──────────────────────────────────────────

export async function enqueuePendingOperation(
  localId: string,
  entity: string,
  operation: "CREATE" | "UPDATE" | "DELETE",
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO pending_operations (local_id, entity, operation, payload) VALUES (?, ?, ?, ?)`,
    [localId, entity, operation, JSON.stringify(payload)],
  );
}

export interface PendingOperation {
  id: number;
  localId: string;
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  retryCount: number;
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    local_id: string;
    entity: string;
    operation: string;
    payload: string;
    retry_count: number;
  }>("SELECT * FROM pending_operations ORDER BY id ASC");
  return rows.map((r) => ({
    id: r.id,
    localId: r.local_id,
    entity: r.entity,
    operation: r.operation as "CREATE" | "UPDATE" | "DELETE",
    payload: JSON.parse(r.payload),
    retryCount: r.retry_count,
  }));
}

export async function deletePendingOperation(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM pending_operations WHERE id = ?", [id]);
}

export async function incrementRetryCount(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pending_operations SET retry_count = retry_count + 1 WHERE id = ?",
    [id],
  );
}

export async function markEntitySynced(
  entity: string,
  localId: string,
  serverId: number,
): Promise<void> {
  // Whitelist estricta: solo tablas conocidas para evitar inyección de nombre de tabla
  const ALLOWED_TABLES = new Map<string, string>([
    ["transactions", "transactions"],
    ["bank_accounts", "bank_accounts"],
    ["financial_objectives", "financial_objectives"],
  ]);
  const table = ALLOWED_TABLES.get(entity);
  if (!table) return;

  // Validar que serverId sea un entero positivo antes de usarlo
  if (!Number.isInteger(serverId) || serverId <= 0) return;

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE ${table} SET id = ?, is_pending_sync = 0, local_id = ? WHERE local_id = ?`,
    [serverId, String(serverId), localId],
  );
}
