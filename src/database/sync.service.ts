import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as objectivesApi from "@/api/objectives.api";
import * as empresasApi from "@/api/empresas.api";
import { isAxiosError } from "axios";
import { apiErrorMessage, classifyApiError } from "@/api/client";
import { MAX_RETRIES, REF_TARGETS, localParentRefs } from "./local-refs";
import {
  getPendingOperations,
  deletePendingOperation,
  incrementRetryCount,
  markOperationFailed,
  markEntitySynced,
  type PendingOperation,
} from "./local.repository";
import type {
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
} from "@/types/transaction.types";
import type {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from "@/types/banking.types";
import type {
  CreateFinancialObjectiveDto,
  UpdateFinancialObjectiveDto,
} from "@/types/objective.types";
import type { CreateEmpresaDto } from "@/types/empresa.types";

export { MAX_RETRIES };

type SyncHandler = (op: PendingOperation) => Promise<{ id: number }>;

const handlers: Record<string, Record<string, SyncHandler>> = {
  transactions: {
    CREATE: async (op) => {
      const payload = op.payload as unknown as CreateTransactionRecordDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await transactionsApi.createTransaction(userId, dto);
      return { id: result.id };
    },
    UPDATE: async (op) => {
      const payload = op.payload as unknown as UpdateTransactionRecordDto & {
        userId: number;
        id: number;
      };
      const { userId, id, ...dto } = payload;
      const result = await transactionsApi.updateTransaction(userId, id, dto);
      return { id: result.id };
    },
    DELETE: async (op) => {
      const { userId, id } = op.payload as unknown as {
        userId: number;
        id: number;
      };
      await transactionsApi.deleteTransaction(userId, id);
      return { id };
    },
  },
  bank_accounts: {
    CREATE: async (op) => {
      const payload = op.payload as unknown as CreateBankAccountDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await bankingApi.createBankAccount(userId, dto);
      return { id: result.id };
    },
    UPDATE: async (op) => {
      const payload = op.payload as unknown as UpdateBankAccountDto & {
        userId: number;
        id: number;
      };
      const { userId, id, ...dto } = payload;
      const result = await bankingApi.updateBankAccount(userId, id, dto);
      return { id: result.id };
    },
    DELETE: async (op) => {
      const { userId, id } = op.payload as unknown as {
        userId: number;
        id: number;
      };
      await bankingApi.deleteBankAccount(userId, id);
      return { id };
    },
  },
  financial_objectives: {
    CREATE: async (op) => {
      const payload = op.payload as unknown as CreateFinancialObjectiveDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await objectivesApi.createObjective(userId, dto);
      return { id: result.id };
    },
    UPDATE: async (op) => {
      const payload = op.payload as unknown as UpdateFinancialObjectiveDto & {
        userId: number;
        id: number;
      };
      const { userId, id, ...dto } = payload;
      const result = await objectivesApi.updateObjective(userId, id, dto);
      return { id: result.id };
    },
    DELETE: async (op) => {
      const { userId, id } = op.payload as unknown as {
        userId: number;
        id: number;
      };
      await objectivesApi.deleteObjective(userId, id);
      return { id };
    },
  },
  companies: {
    CREATE: async (op) => {
      const payload = op.payload as unknown as CreateEmpresaDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await empresasApi.createEmpresa(userId, dto);
      return { id: result.id };
    },
    // Editar/borrar empresas desde móvil no está soportado todavía — si no
    // hay handler para la operación, syncPendingOperations descarta el
    // registro pendiente en vez de reintentarlo indefinidamente.
  },
};

/** Entidades permitidas en sincronización (whitelist para evitar procesar entidades arbitrarias). */
const ALLOWED_ENTITIES = new Set([
  "transactions",
  "bank_accounts",
  "financial_objectives",
  "companies",
]);

/** Operaciones permitidas. */
const ALLOWED_OPERATIONS = new Set(["CREATE", "UPDATE", "DELETE"]);

/**
 * Resultado de una ejecución de sincronización.
 * - synced: operaciones enviadas al servidor exitosamente.
 * - failed: operaciones que fallaron (red/5xx: +1 retryCount; 4xx: quedan
 *   atascadas con `lastError`). Las que esperan a que su padre offline
 *   sincronice no cuentan en ningún grupo.
 * - skipped: operaciones atascadas (límite de reintentos o rechazo 4xx).
 */
export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
}

/**
 * Procesa todas las operaciones offline pendientes y las envía al servidor.
 * Cada operación se valida contra la whitelist antes de procesarse.
 * Si una operación falla, se incrementa su retryCount.
 * Cuando retryCount >= MAX_RETRIES, la operación se omite (skipped).
 */
export async function syncPendingOperations(): Promise<SyncResult> {
  const pending = await getPendingOperations();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0 };
  const syncedIds = new Set<number>();

  for (const op of pending) {
    // Validar que entidad y operación estén en la whitelist antes de procesar
    if (
      !ALLOWED_ENTITIES.has(op.entity) ||
      !ALLOWED_OPERATIONS.has(op.operation)
    ) {
      await deletePendingOperation(op.id);
      continue;
    }

    if (op.retryCount >= MAX_RETRIES) {
      result.skipped++;
      continue;
    }

    const handler = handlers[op.entity]?.[op.operation];
    if (!handler) {
      await deletePendingOperation(op.id);
      continue;
    }

    // Aún apunta a una cuenta/meta/empresa creada offline (id negativo): el
    // servidor la rechazaría con 4xx y quedaría atascada. Espera, sin gastar
    // reintentos, a que el CREATE del padre sincronice (eso remapea el id).
    // Sin un CREATE del padre activo (atascado o descartado) nunca lo hará.
    const parents = localParentRefs(op.payload);
    if (parents.length > 0) {
      // ponytail: coincide por tipo de entidad, no por el id exacto del padre
      // (el CREATE no guarda su id de fila). Una huérfana puede esperar una
      // corrida de más mientras otro CREATE de ese tipo siga activo.
      const parentActive = pending.some(
        (p) =>
          p.operation === "CREATE" &&
          parents.includes(p.entity) &&
          p.retryCount < MAX_RETRIES &&
          !syncedIds.has(p.id),
      );
      if (!parentActive) {
        await markOperationFailed(
          op.id,
          "Depende de una cuenta, meta o empresa que no se sincronizó",
          MAX_RETRIES,
        );
        op.retryCount = MAX_RETRIES;
        result.failed++;
      }
      continue;
    }

    try {
      const { id: serverId } = await handler(op);
      await markEntitySynced(op.entity, op.localId, serverId);
      if (op.operation === "CREATE" && REF_TARGETS[op.entity]) {
        // markEntitySynced remapeó en SQLite las referencias al id local de
        // las operaciones siguientes; `pending` es una copia en memoria.
        const fresh = (await getPendingOperations()) ?? [];
        for (const next of pending) {
          const updated = fresh.find((f) => f.id === next.id);
          if (updated) next.payload = updated.payload;
        }
      }
      await deletePendingOperation(op.id);
      syncedIds.add(op.id);
      result.synced++;
    } catch (err) {
      // 4xx: reintentar daría el mismo rechazo → queda atascada con su motivo
      // hasta que el usuario pulse "Reintentar". Red, 5xx o sesión expirada son
      // transitorios: cuentan un reintento más (el bloqueo de Cloud Armor, abajo,
      // ni eso).
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404 && op.operation === "DELETE") {
        // Ya lo borró otro dispositivo: el resultado es el que se quería.
        await deletePendingOperation(op.id);
        result.synced++;
        continue;
      }
      // `blocked` (403 de Cloud Armor) depende de la red, no de la operación: no
      // se atasca ni gasta reintentos. Se corta el ciclo (el resto fallaría igual)
      // y la cola queda pendiente para la próxima corrida en una red permitida.
      // `failed` sube para que el usuario vea el bloqueo.
      const kind = classifyApiError(err);
      if (kind === "blocked") {
        result.failed++;
        break;
      }
      if (kind === "client") {
        await markOperationFailed(
          op.id,
          status === 404 && op.operation === "UPDATE"
            ? "Ya no existe en el servidor (se borró desde otro dispositivo)"
            : apiErrorMessage(err, `El servidor rechazó el cambio (HTTP ${status ?? "4xx"})`),
          MAX_RETRIES,
        );
        op.retryCount = MAX_RETRIES;
      } else {
        await incrementRetryCount(op.id);
        op.retryCount++;
      }
      // `pending` es la copia en memoria que consultan las hijas de esta op:
      // si el padre quedó atascado, sus hijas se atascan en esta misma corrida.
      result.failed++;
    }
  }

  return result;
}
