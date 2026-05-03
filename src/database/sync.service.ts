import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as objectivesApi from "@/api/objectives.api";
import {
  getPendingOperations,
  deletePendingOperation,
  incrementRetryCount,
  markEntitySynced,
  type PendingOperation,
} from "./local.repository";
import type { CreateTransactionRecordDto } from "@/types/transaction.types";
import type { CreateBankAccountDto } from "@/types/banking.types";
import type { CreateFinancialObjectiveDto } from "@/types/objective.types";

const MAX_RETRIES = 3;

type SyncHandler = (op: PendingOperation) => Promise<{ id: number }>;

const handlers: Record<string, Record<string, SyncHandler>> = {
  transactions: {
    CREATE: async (op) => {
      const payload = op.payload as CreateTransactionRecordDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await transactionsApi.createTransaction(userId, dto);
      return { id: result.id };
    },
  },
  bank_accounts: {
    CREATE: async (op) => {
      const payload = op.payload as CreateBankAccountDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await bankingApi.createBankAccount(userId, dto);
      return { id: result.id };
    },
  },
  financial_objectives: {
    CREATE: async (op) => {
      const payload = op.payload as CreateFinancialObjectiveDto & {
        userId: number;
        localId: string;
      };
      const { userId, localId: _localId, ...dto } = payload;
      const result = await objectivesApi.createObjective(userId, dto);
      return { id: result.id };
    },
  },
};

/** Entidades permitidas en sincronización (whitelist para evitar procesar entidades arbitrarias). */
const ALLOWED_ENTITIES = new Set([
  "transactions",
  "bank_accounts",
  "financial_objectives",
]);

/** Operaciones permitidas. */
const ALLOWED_OPERATIONS = new Set(["CREATE", "UPDATE", "DELETE"]);

/**
 * Resultado de una ejecución de sincronización.
 * - synced: operaciones enviadas al servidor exitosamente.
 * - failed: operaciones que fallaron (se incrementa su retryCount).
 * - skipped: operaciones que superaron el límite de reintentos.
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

    try {
      const { id: serverId } = await handler(op);
      await markEntitySynced(op.entity, op.localId, serverId);
      await deletePendingOperation(op.id);
      result.synced++;
    } catch {
      await incrementRetryCount(op.id);
      result.failed++;
    }
  }

  return result;
}
