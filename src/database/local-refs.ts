import type * as SQLite from "expo-sqlite";

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
    const payload = JSON.parse(op.payload) as Record<string, unknown>;
    const remapped = remapPayloadRef(payload, entity, oldId, newId);
    if (remapped !== payload) {
      await db.runAsync("UPDATE pending_operations SET payload = ? WHERE id = ?", [
        JSON.stringify(remapped),
        op.id,
      ]);
    }
  }
}
