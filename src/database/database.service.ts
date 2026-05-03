import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Retorna (o crea) la instancia única de la base de datos SQLite local.
 * Usa el patrón singleton para evitar abrir múltiples conexiones.
 * Ejecuta la inicialización del esquema en la primera apertura.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("cost_manager.db");
    await initSchema(db);
  }
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    -- Sobreescribir páginas eliminadas con ceros (evita recuperación forense de datos)
    PRAGMA secure_delete = ON;
    -- Almacenar tablas temporales en memoria, no en disco
    PRAGMA temp_store = MEMORY;

    -- Usuario local (caché del perfil)
    CREATE TABLE IF NOT EXISTS local_user (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      keycloak_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Categorías
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      type TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE')),
      is_system INTEGER DEFAULT 0,
      created_at TEXT,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    -- Subcategorías
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      created_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Cuentas bancarias
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'COP',
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0
    );

    -- Transacciones
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      subcategory_id INTEGER,
      bank_account_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE','TRANSFER')),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'COP',
      description TEXT,
      transaction_date TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Objetivos financieros
    CREATE TABLE IF NOT EXISTS financial_objectives (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'COP',
      target_date TEXT NOT NULL,
      description TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0
    );

    -- Pagos a objetivos
    CREATE TABLE IF NOT EXISTS objective_payments (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      objective_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'COP',
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT,
      is_pending_sync INTEGER DEFAULT 0,
      FOREIGN KEY (objective_id) REFERENCES financial_objectives(id)
    );

    -- Cola de operaciones pendientes para sincronizar
    CREATE TABLE IF NOT EXISTS pending_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0
    );
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
