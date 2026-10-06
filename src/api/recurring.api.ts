import { apiClient, isListPayload, unwrapList } from "./client";
import { normalizeTransaction } from "./transactions.api";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type {
  CreateRecurringTransactionDto,
  RecurringProcessResult,
  RecurringStatus,
  RecurringTransaction,
  UpdateRecurringTransactionDto,
  ValidateRecurringTransactionDto,
} from "@/types/recurring.types";

/**
 * Recurrentes (R8.1). Todas las escrituras requieren conexión: no pasan por
 * `pending_operations` (R8.5). El API ya manda los montos e ids de la regla
 * como número; la transacción de `validate` sí llega cruda y se normaliza.
 * Tras crear, editar o validar, el API procesa de inmediato: recargar
 * transacciones y cuentas.
 */

// El interceptor deja un item único como `[item]`.
function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

const base = (userId: number) => `/users/${userId}/recurring-transactions`;

export async function listRecurring(
  userId: number,
  status?: RecurringStatus,
): Promise<RecurringTransaction[]> {
  const { data } = await apiClient.get<
    RecurringTransaction[] | { data: RecurringTransaction[]; total?: number }
  >(base(userId), { params: status ? { status } : undefined });
  // Una forma inesperada no es "cero recurrentes": guardarla vaciaría el caché.
  if (!isListPayload(data)) throw new Error("Respuesta inesperada al listar recurrentes");
  return unwrapList(data);
}

export async function getRecurring(
  userId: number,
  id: number,
): Promise<RecurringTransaction> {
  const { data } = await apiClient.get<RecurringTransaction | RecurringTransaction[]>(
    `${base(userId)}/${id}`,
  );
  return one(data);
}

export async function createRecurring(
  userId: number,
  dto: CreateRecurringTransactionDto,
): Promise<RecurringTransaction> {
  const { data } = await apiClient.post<RecurringTransaction | RecurringTransaction[]>(
    base(userId),
    dto,
  );
  return one(data);
}

export async function updateRecurring(
  userId: number,
  id: number,
  dto: UpdateRecurringTransactionDto,
): Promise<RecurringTransaction> {
  const { data } = await apiClient.patch<RecurringTransaction | RecurringTransaction[]>(
    `${base(userId)}/${id}`,
    dto,
  );
  return one(data);
}

export async function cancelRecurring(
  userId: number,
  id: number,
): Promise<RecurringTransaction> {
  const { data } = await apiClient.post<RecurringTransaction | RecurringTransaction[]>(
    `${base(userId)}/${id}/cancel`,
  );
  return one(data);
}

/** Una vez al día por usuario: un `{0,0,0}` no significa "nada pendiente". */
export async function processRecurring(userId: number): Promise<RecurringProcessResult> {
  const { data } = await apiClient.post<RecurringProcessResult | RecurringProcessResult[]>(
    `${base(userId)}/process`,
  );
  return one(data);
}

/** En una transferencia valida las dos piernas y devuelve la del id. */
export async function validateRecurringTransaction(
  userId: number,
  transactionId: number,
  dto: ValidateRecurringTransactionDto,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.post<
    TransactionRecordResponse | TransactionRecordResponse[]
  >(`${base(userId)}/validate/${transactionId}`, dto);
  return normalizeTransaction(one(data));
}
