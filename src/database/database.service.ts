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
      // v2: esquema alineado a snake_case + campos reales del backend.
      // Nombre de archivo nuevo para forzar una base limpia (evita choques con
      // instalaciones existentes que tengan el esquema v1 camelCase).
      const instance = await SQLiteModule.openDatabaseAsync("cost_manager_v2.db");
      await initSchema(instance);
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

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  dbPromise = null;
}
