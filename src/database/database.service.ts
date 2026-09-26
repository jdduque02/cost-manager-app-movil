import type * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { remapReferences } from "./local-refs";

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
      try {
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
        await migrateObjectivesTable(instance);
        await migratePendingOperationsTable(instance);
        await rebuildObjectivesTableIfLegacyCheckExists(instance);
        await migrateLocalIdsToNegative(instance);
        db = instance;
        return instance;
      } catch (error) {
        // Si cualquier paso de apertura/migración falla, no dejamos la
        // promesa fallida cacheada para siempre: eso convertiría un error
        // puntual (p.ej. de migración) en una app inutilizable de forma
        // permanente, porque toda la capa de datos depende de
        // `getDatabase()`. Al resetear `dbPromise` a null, la siguiente
        // llamada puede reintentar la apertura desde cero.
        dbPromise = null;
        throw error;
      }
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
    -- Nota: sin CHECK sobre "type" a propósito. Un CHECK aquí se queda
    -- desactualizado cada vez que el backend agrega un tipo nuevo (pasó con
    -- 'emergency_fund'). La validación de type ya vive en el tipo TS
    -- FinancialObjectiveType y, de forma autoritativa, en el backend.
    -- Este CREATE TABLE IF NOT EXISTS solo aplica a instalaciones NUEVAS: en
    -- instalaciones existentes la tabla física ya está creada en disco con el
    -- CHECK antiguo grabado en sqlite_master, y SQLite no permite ALTER de un
    -- CHECK existente -- por eso rebuildObjectivesTableIfLegacyCheckExists,
    -- más abajo, reconstruye la tabla completa (copiar filas a una tabla
    -- nueva sin CHECK, dropear la vieja, renombrar) cuando detecta el CHECK
    -- legado. No lo quites: sin eso, cualquier instalación previa a esta
    -- feature rechaza silenciosamente los objetivos type='emergency_fund'.
    -- months_of_expenses_covered (solo emergency_fund) se agrega vía
    -- migrateObjectivesTable para no romper instalaciones existentes.
    CREATE TABLE IF NOT EXISTS financial_objectives (
      id INTEGER PRIMARY KEY,
      local_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
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
      retry_count INTEGER DEFAULT 0,
      -- Motivo del último rechazo 4xx del servidor (NULL = sin error permanente)
      last_error TEXT
    );
  `);
}

/** Agrega `pending_operations.last_error` en instalaciones previas (idempotente, sin perder la cola). */
export async function migratePendingOperationsTable(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(pending_operations)",
  );
  if (!columns.some((c) => c.name === "last_error")) {
    await database.execAsync("ALTER TABLE pending_operations ADD COLUMN last_error TEXT");
  }
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

/**
 * Agrega a `financial_objectives` la columna `months_of_expenses_covered`
 * (calculada por el backend solo para type=emergency_fund) que no existía en
 * instalaciones previas. Sigue el mismo patrón idempotente que
 * `migrateTransactionsTable`: en instalaciones nuevas el CREATE TABLE ya la
 * incluye implícitamente vía este ALTER en el primer arranque, y en
 * instalaciones existentes solo la agrega si falta, sin perder filas.
 */
export async function migrateObjectivesTable(database: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(financial_objectives)",
  );
  const existing = new Set(existingColumns.map((c) => c.name));
  if (!existing.has("months_of_expenses_covered")) {
    await database.execAsync(
      "ALTER TABLE financial_objectives ADD COLUMN months_of_expenses_covered REAL",
    );
  }
}

/**
 * Reconstruye `financial_objectives` cuando la tabla física en disco todavía
 * tiene el `CHECK(type IN ('loan','savings','goal'))` legado grabado en
 * `sqlite_master`.
 *
 * Por qué hace falta: `CREATE TABLE IF NOT EXISTS` (en `initSchema`) es un
 * no-op si la tabla ya existe, así que quitar el CHECK del texto del DDL solo
 * afecta instalaciones nuevas. En un dispositivo con instalación previa, el
 * archivo `cost_manager_v2.db` se reutiliza entre versiones (ver el
 * comentario en `getDatabase()`), así que la tabla sigue validando el CHECK
 * viejo. SQLite tampoco permite `ALTER TABLE ... DROP CONSTRAINT`/modificar
 * un CHECK existente -- la única forma de relajarlo es el patrón estándar de
 * reconstrucción: crear una tabla nueva con el esquema actual (sin CHECK),
 * copiar todas las filas, dropear la vieja y renombrar la nueva.
 *
 * Idempotente: consulta `sqlite_master` y solo actúa si el CHECK sigue
 * presente; en instalaciones nuevas o ya migradas no hace nada. Preserva
 * todas las columnas, incluida `is_pending_sync` (crítica: objetivos offline
 * sin sincronizar todavía en `pending_operations` no deben perderse) y
 * `months_of_expenses_covered` (puede o no existir según si
 * `migrateObjectivesTable` ya corrió antes).
 *
 * IMPORTANTE (foreign_keys): `objective_payments.objective_id` referencia
 * `financial_objectives(id)` y `PRAGMA foreign_keys = ON` está activo (ver
 * `initSchema`). Con la FK activa, `DROP TABLE financial_objectives` falla
 * con `FOREIGN KEY constraint failed` en cuanto existe al menos una fila en
 * `objective_payments` (feature "Pagos a objetivos", ya en uso). SQLite
 * documenta el patrón oficial para reconstrucciones de esquema con FKs de
 * hijos: desactivar `foreign_keys` ANTES de la secuencia
 * CREATE/INSERT/DROP/RENAME y reactivarlo al final. `PRAGMA foreign_keys`
 * solo tiene efecto fuera de una transacción activa, así que no puede ir
 * dentro de `withTransactionAsync` -- por eso el toggle ocurre fuera del
 * `BEGIN/COMMIT` y la reconstrucción en sí se envuelve en `try/finally` para
 * garantizar que la protección de integridad referencial se reactive incluso
 * si la reconstrucción falla a mitad de camino.
 */
export async function rebuildObjectivesTableIfLegacyCheckExists(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const tableDef = await database.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'financial_objectives'",
  );
  if (!tableDef?.sql || !tableDef.sql.includes("CHECK")) {
    return;
  }

  await database.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE financial_objectives_new (
          id INTEGER PRIMARY KEY,
          local_id TEXT UNIQUE,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          target_amount REAL,
          current_balance REAL NOT NULL DEFAULT 0,
          start_date TEXT,
          end_date TEXT,
          is_completed INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          is_pending_sync INTEGER DEFAULT 0,
          months_of_expenses_covered REAL
        );
        INSERT INTO financial_objectives_new
          (id, local_id, user_id, name, type, target_amount, current_balance,
           start_date, end_date, is_completed, created_at, updated_at,
           is_pending_sync, months_of_expenses_covered)
        SELECT
          id, local_id, user_id, name, type, target_amount, current_balance,
          start_date, end_date, is_completed, created_at, updated_at,
          is_pending_sync, months_of_expenses_covered
        FROM financial_objectives;
        DROP TABLE financial_objectives;
        ALTER TABLE financial_objectives_new RENAME TO financial_objectives;
      `);
    });
  } finally {
    await database.execAsync("PRAGMA foreign_keys = ON;");
  }
}

/**
 * Bases de dev creadas antes de los ids locales negativos tienen filas
 * pendientes con id positivo (autoincrement), que pueden chocar con un id del
 * servidor y ser pisadas por un `INSERT OR REPLACE`. Las renumera a negativo,
 * remapea las referencias (transacciones, pagos, payloads de la cola) y
 * enmascara `account_number` en la tabla (el payload de la cola conserva el
 * real para el sync). Idempotente: sin filas pendientes positivas no hace nada.
 */
export async function migrateLocalIdsToNegative(database: SQLite.SQLiteDatabase): Promise<void> {
  const tables = ["bank_accounts", "financial_objectives", "companies", "transactions"];
  await database.withTransactionAsync(async () => {
    await database.execAsync("PRAGMA defer_foreign_keys = ON");
    for (const table of tables) {
      // `table` sale de la lista fija de arriba, no de input externo.
      const rows = await database.getAllAsync<{ id: number }>(
        `SELECT id FROM ${table} WHERE is_pending_sync = 1 AND id > 0 ORDER BY id`,
      );
      if (rows.length === 0) continue;
      const min = await database.getFirstAsync<{ m: number | null }>(
        `SELECT MIN(id) AS m FROM ${table}`,
      );
      let next = Math.min(0, min?.m ?? 0);
      for (const { id: oldId } of rows) {
        next -= 1;
        await remapReferences(database, table, oldId, next);
        await database.runAsync(`UPDATE ${table} SET id = ? WHERE id = ?`, [next, oldId]);
      }
    }
    await database.execAsync(`
      UPDATE bank_accounts
      SET account_number = CASE WHEN length(account_number) < 4 THEN '****' ELSE '****' || substr(account_number, -4) END
      WHERE account_number IS NOT NULL AND account_number NOT LIKE '****%'
    `);
  });
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  dbPromise = null;
}
