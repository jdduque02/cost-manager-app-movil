import type * as SQLite from "expo-sqlite";

/**
 * Una operación con `retry_count >= MAX_RETRIES` está atascada: el sync
 * automático la salta hasta que el usuario pulse "Reintentar" o "Descartar".
 * Vive aquí (sin dependencias) para que repositorio y sync la compartan sin
 * importarse en círculo.
 */
export const MAX_RETRIES = 3;

/** Motivo que se muestra para una operación cuyo payload no es JSON válido. */
export const CORRUPT_PAYLOAD_REASON = "El cambio guardado está dañado y no se puede enviar";

/**
 * Columnas que apuntan a filas creadas offline. Al sincronizar una entidad su
 * id local (negativo) pasa a ser el del servidor: hay que remapear estas
 * columnas y las mismas claves dentro de los payloads de `pending_operations`.
 * La primera columna de cada lista es también la clave del payload.
 */
export const REF_TARGETS: Record<string, [table: string, column: string][]> = {
  bank_accounts: [["transactions", "account_id"]],
  financial_objectives: [
    ["transactions", "objective_id"],
    ["objective_payments", "objective_id"],
  ],
  companies: [["transactions", "company_id"]],
};

/** Payload de la cola, o `null` si no es un objeto JSON válido. */
export function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Entidades padre (cuenta/meta/empresa) a las que el payload aún apunta con un id local (negativo). */
export function localParentRefs(payload: Record<string, unknown>): string[] {
  return Object.keys(REF_TARGETS).filter((entity) => {
    const value = payload[REF_TARGETS[entity][0][1]];
    return typeof value === "number" && value < 0;
  });
}

/** Devuelve el payload con la referencia `oldId` → `newId` (o el mismo objeto si no aplica). */
export function remapPayloadRef(
  payload: Record<string, unknown>,
  entity: string,
  oldId: number,
  newId: number,
): Record<string, unknown> {
  const key = REF_TARGETS[entity]?.[0][1];
  return key && payload[key] === oldId ? { ...payload, [key]: newId } : payload;
}

/**
 * Reasigna toda referencia a `oldId` de `entity` por `newId`: columnas de las
 * tablas hijas y payloads de `pending_operations`. Llamar dentro de una
 * transacción.
 */
export async function remapReferences(
  db: Pick<SQLite.SQLiteDatabase, "runAsync" | "getAllAsync">,
  entity: string,
  oldId: number,
  newId: number,
): Promise<void> {
  // Tablas y columnas salen de REF_TARGETS (literales), no de input externo.
  for (const [table, column] of REF_TARGETS[entity] ?? []) {
    await db.runAsync(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [newId, oldId]);
  }
  const ops = await db.getAllAsync<{ id: number; payload: string }>(
    "SELECT id, payload FROM pending_operations",
  );
  for (const op of ops) {
    const payload = parsePayload(op.payload);
    if (!payload) {
      // Lanzar aquí revertiría la transacción: la migración de arranque
      // fallaría y, en el sync, el CREATE del padre (ya aceptado por el
      // servidor) se reenviaría duplicado. La dañada queda atascada.
      await db.runAsync(
        "UPDATE pending_operations SET retry_count = MAX(retry_count, ?), last_error = ? WHERE id = ?",
        [MAX_RETRIES, CORRUPT_PAYLOAD_REASON, op.id],
      );
      continue;
    }
    const remapped = remapPayloadRef(payload, entity, oldId, newId);
    if (remapped !== payload) {
      await db.runAsync("UPDATE pending_operations SET payload = ? WHERE id = ?", [
        JSON.stringify(remapped),
        op.id,
      ]);
    }
  }
}
