import type * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function loadSQLite(): Promise<typeof import("expo-sqlite")> {
  return import("expo-sqlite");
}

/**
 * Retorna (o crea) la instancia única de la base de datos SQLite local.
 * Usa el patrón singleton para evitar abrir múltiples conexiones.
 * Ejecuta la inicialización del esquema en la primera apertura.
 * expo-sqlite es un módulo nativo: no funciona en web.
 *
 * `dbPromise` evita una condición de carrera: al arrancar la app, `_layout.tsx`,
 * `auth.store.initialize()` y el fallback de `useOfflineQuery` pueden llamar a
 * esta función casi simultáneamente. Sin este guard, varias llamadas verían
 * `db === null` a la vez y cada una intentaría abrir/inicializar el esquema
 * por su cuenta, lo que provoca un NullPointerException nativo en
 * `NativeDatabase.prepareAsync`. Todas las llamadas concurrentes ahora esperan
 * la misma apertura en curso.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === "web") {
    throw new Error("expo-sqlite is not available on web. Use a native platform (Android/iOS).");
  }
  if (db) return db;
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLiteModule = await loadSQLite();
      // Se mantiene el mismo archivo que v2 (a diferencia de la migración
      // v1→v2, que sí forzó una base limpia): un usuario puede tener
      // transacciones offline sin sincronizar en `pending_operations` en este
      // archivo, y renombrarlo las perdería silenciosamente. Las columnas
      // nuevas de transacción fija/cuotas/asociaciones se agregan vía
      // `migrateTransactionsTable` (ALTER TABLE) en vez de recrear la base.
      const instance = await SQLiteModule.openDatabaseAsync("cost_manager_v2.db");
      await initSchema(instance);
      await migrateTransactionsTable(instance);
      db = instance;
      return instance;
    })();
  }
  return dbPromise;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    -- Sobreescribir páginas eliminadas con ceros (evita recuperación forense de datos)
    PRAGMA secure_delete = ON;
    -- Almacenar tablas temporales en memoria, no en disco
    PRAGMA temp_store = MEMORY;

    -- El perfil de usuario (PII: username/email/nombre) YA NO se cachea acá.
    -- SQLite no cifra su archivo por defecto (no hay SQLCipher instalado), así
    -- que se movió a caché encriptada vía expo-secure-store —
    -- ver src/database/secure-user-cache.ts. Este DROP limpia el archivo .db
    -- de instalaciones existentes que ya tenían PII en texto plano en esta tabla.
    DROP TABLE IF EXISTS local_user;

    -- Categorías
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      icon_key TEXT,
      color_hex TEXT,
      group_type TEXT NOT NULL CHECK(group_type IN ('income','expense','investment')),
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    -- Subcategorías
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon_key TEXT,
      color_hex TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Cuentas bancarias
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      bank_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      account_number TEXT,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'COP',
      is_primary INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0
    );

    -- Transacciones
    -- Nota: las columnas de transacción fija/cuotas/método de pago/asociaciones
    -- (payment_method, fixed_type, frequency, due_day, reminder_days,
    -- installments, installment_value, source_bank, source_account,
    -- asset_id, liability_id, objective_id, company_id) NO están acá — este
    -- CREATE TABLE solo corre en instalaciones nuevas sin la tabla todavía.
    -- Para instalaciones existentes (archivo v2 ya creado), esas columnas se
    -- agregan vía ALTER TABLE en migrateTransactionsTable, más abajo, para
    -- no perder transacciones/pending_operations sin sincronizar.
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      subcategory_id INTEGER,
      account_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income','expense','investment','transfer')),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'COP',
      is_fixed INTEGER DEFAULT 0,
      description TEXT,
      transaction_date TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Empresas asociables a una transacción (creación inline "al vuelo")
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      default_category_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      is_pending_sync INTEGER DEFAULT 0
    );

    -- Activos financieros (solo lectura offline — sin creación inline todavía)
    CREATE TABLE IF NOT EXISTS financial_assets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      asset_type TEXT NOT NULL,
      name TEXT NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      current_yield REAL,
      currency TEXT NOT NULL DEFAULT 'COP',
      created_at TEXT,
      updated_at TEXT
    );

    -- Pasivos financieros (solo lectura offline — sin creación inline todavía)
    CREATE TABLE IF NOT EXISTS financial_liabilities (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      liability_type TEXT NOT NULL,
      name TEXT NOT NULL,
      current_balance REAL NOT NULL DEFAULT 0,
      interest_rate REAL,
      currency TEXT NOT NULL DEFAULT 'COP',
      created_at TEXT,
      updated_at TEXT
    );

    -- Objetivos financieros
    CREATE TABLE IF NOT EXISTS financial_objectives (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('loan','savings','goal')),
      target_amount REAL,
      current_balance REAL NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
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
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      note TEXT,
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

/**
 * Agrega a `transactions` las columnas de transacción fija/cuotas/método de
 * pago/asociaciones patrimoniales que no existían en el esquema original v2.
 * Idempotente: en instalaciones nuevas el CREATE TABLE de `initSchema` ya
 * crea la tabla con todas las columnas, así que `PRAGMA table_info` las
 * encuentra todas y no hace ningún ALTER. En instalaciones existentes agrega
 * solo las columnas que faltan, preservando filas y `pending_operations` en
 * vez de recrear el archivo de base de datos.
 */
async function migrateTransactionsTable(database: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(transactions)",
  );
  const existing = new Set(existingColumns.map((c) => c.name));
  const newColumns: [string, string][] = [
    ["asset_id", "INTEGER"],
    ["liability_id", "INTEGER"],
    ["objective_id", "INTEGER"],
    ["company_id", "INTEGER"],
    ["payment_method", "TEXT"],
    ["fixed_type", "TEXT"],
    ["frequency", "TEXT"],
    ["due_day", "INTEGER"],
    ["reminder_days", "INTEGER"],
    ["installments", "INTEGER"],
    ["installment_value", "REAL"],
    ["source_bank", "TEXT"],
    ["source_account", "TEXT"],
  ];
  for (const [name, type] of newColumns) {
    if (!existing.has(name)) {
      // Nombres/tipos vienen de la lista fija de arriba (no de input externo),
      // así que interpolarlos en el DDL no abre una inyección SQL.
      await database.execAsync(`ALTER TABLE transactions ADD COLUMN ${name} ${type}`);
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  dbPromise = null;
}
