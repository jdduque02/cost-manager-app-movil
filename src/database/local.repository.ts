import { getDatabase } from "./database.service";
import type { UserResponse } from "@/types/user.types";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
} from "@/types/transaction.types";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
} from "@/types/banking.types";
import type {
  FinancialObjectiveResponse,
  CreateFinancialObjectiveDto,
} from "@/types/objective.types";
import type {
  CategoryResponse,
  SubcategoryResponse,
} from "@/types/catalog.types";

// ─── Utilidad ───────────────────────────────────────────────────────────────

/** Genera un ID local usando crypto.getRandomValues (criptográficamente seguro). */
function generateLocalId(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return `local_${hex}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Usuario ─────────────────────────────────────────────────────────────────

export async function cacheUser(user: UserResponse): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO local_user
      (id, username, email, first_name, last_name, keycloak_id, is_active, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.email,
      user.firstName,
      user.lastName,
      user.keycloakId ?? null,
      user.isActive ? 1 : 0,
      user.createdAt,
      user.updatedAt,
      now(),
    ],
  );
}

export async function getCachedUser(): Promise<UserResponse | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    keycloak_id: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM local_user LIMIT 1");

  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    keycloakId: row.keycloak_id ?? "",
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function clearCachedUser(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM local_user");
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function saveCategories(
  categories: CategoryResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const cat of categories) {
    await db.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, icon, color, type, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cat.id,
        cat.name,
        cat.icon ?? null,
        cat.color ?? null,
        cat.type,
        cat.isSystem ? 1 : 0,
        cat.createdAt,
      ],
    );
  }
}

export async function getLocalCategories(): Promise<CategoryResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    icon: string | null;
    color: string | null;
    type: string;
    is_system: number;
    created_at: string;
  }>("SELECT * FROM categories");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    type: r.type as "INCOME" | "EXPENSE",
    isSystem: r.is_system === 1,
    createdAt: r.created_at,
  }));
}

export async function saveSubcategories(
  subs: SubcategoryResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const s of subs) {
    await db.runAsync(
      `INSERT OR REPLACE INTO subcategories (id, category_id, name, icon, created_at) VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.categoryId, s.name, s.icon ?? null, s.createdAt],
    );
  }
}

export async function getLocalSubcategories(
  categoryId?: number,
): Promise<SubcategoryResponse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    category_id: number;
    name: string;
    icon: string | null;
    created_at: string;
  }>(
    categoryId
      ? "SELECT * FROM subcategories WHERE category_id = ?"
      : "SELECT * FROM subcategories",
    categoryId ? [categoryId] : [],
  );
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    icon: r.icon,
    createdAt: r.created_at,
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
        (id, local_id, user_id, name, bank_name, account_type, balance, currency, is_active, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        a.id,
        String(a.id),
        a.userId,
        a.name,
        a.bankName,
        a.accountType,
        a.balance,
        a.currency,
        a.isActive ? 1 : 0,
        a.createdAt,
        a.updatedAt,
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
    name: string;
    bank_name: string;
    account_type: string;
    balance: number;
    currency: string;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM bank_accounts WHERE user_id = ? AND is_active = 1", [
    userId,
  ]);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    bankName: r.bank_name,
    accountType: r.account_type,
    balance: r.balance,
    currency: r.currency,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
    `INSERT INTO bank_accounts (local_id, user_id, name, bank_name, account_type, balance, currency, is_active, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
    [
      localId,
      userId,
      dto.name,
      dto.bankName,
      dto.accountType,
      dto.balance,
      dto.currency,
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
    userId,
    name: dto.name,
    bankName: dto.bankName,
    accountType: dto.accountType,
    balance: dto.balance,
    currency: dto.currency,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ─── Transacciones ────────────────────────────────────────────────────────────

export async function saveTransactions(
  transactions: TransactionRecordResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const t of transactions) {
    await db.runAsync(
      `INSERT OR REPLACE INTO transactions
        (id, local_id, user_id, category_id, subcategory_id, bank_account_id, type, amount, currency, description, transaction_date, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        t.id,
        String(t.id),
        t.userId,
        t.categoryId,
        t.subcategoryId ?? null,
        t.bankAccountId ?? null,
        t.type,
        t.amount,
        t.currency,
        t.description ?? null,
        t.transactionDate,
        t.createdAt,
        t.updatedAt,
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
    category_id: number;
    subcategory_id: number | null;
    bank_account_id: number | null;
    type: string;
    amount: number;
    currency: string;
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
    userId: r.user_id,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    bankAccountId: r.bank_account_id,
    type: r.type as TransactionRecordResponse["type"],
    amount: r.amount,
    currency: r.currency,
    description: r.description,
    transactionDate: r.transaction_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
      (local_id, user_id, category_id, subcategory_id, bank_account_id, type, amount, currency, description, transaction_date, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      localId,
      userId,
      dto.categoryId,
      dto.subcategoryId ?? null,
      dto.bankAccountId ?? null,
      dto.type,
      dto.amount,
      dto.currency,
      dto.description ?? null,
      dto.transactionDate,
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
    userId,
    categoryId: dto.categoryId,
    subcategoryId: dto.subcategoryId ?? null,
    bankAccountId: dto.bankAccountId ?? null,
    type: dto.type,
    amount: dto.amount,
    currency: dto.currency,
    description: dto.description ?? null,
    transactionDate: dto.transactionDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ─── Objetivos financieros ───────────────────────────────────────────────────

export async function saveObjectives(
  objectives: FinancialObjectiveResponse[],
): Promise<void> {
  const db = await getDatabase();
  for (const o of objectives) {
    await db.runAsync(
      `INSERT OR REPLACE INTO financial_objectives
        (id, local_id, user_id, name, target_amount, current_amount, currency, target_date, description, is_completed, created_at, updated_at, is_pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        o.id,
        String(o.id),
        o.userId,
        o.name,
        o.targetAmount,
        o.currentAmount,
        o.currency,
        o.targetDate,
        o.description ?? null,
        o.isCompleted ? 1 : 0,
        o.createdAt,
        o.updatedAt,
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
    target_amount: number;
    current_amount: number;
    currency: string;
    target_date: string;
    description: string | null;
    is_completed: number;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM financial_objectives WHERE user_id = ?", [userId]);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    targetAmount: r.target_amount,
    currentAmount: r.current_amount,
    currency: r.currency,
    targetDate: r.target_date,
    description: r.description,
    isCompleted: r.is_completed === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
      (local_id, user_id, name, target_amount, current_amount, currency, target_date, description, is_completed, created_at, updated_at, is_pending_sync)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, 1)`,
    [
      localId,
      userId,
      dto.name,
      dto.targetAmount,
      dto.currency,
      dto.targetDate,
      dto.description ?? null,
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
    userId,
    name: dto.name,
    targetAmount: dto.targetAmount,
    currentAmount: 0,
    currency: dto.currency,
    targetDate: dto.targetDate,
    description: dto.description ?? null,
    isCompleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
