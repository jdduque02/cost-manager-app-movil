import { apiClient, unwrapList } from "./client";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
  TransactionQueryDto,
  PaginatedTransactions,
  CloneTransactionDto,
  TransactionSummary,
  TransactionSummaryAmounts,
  TransactionSummaryQuery,
} from "@/types/transaction.types";

function normalizeTransaction(
  t: TransactionRecordResponse,
): TransactionRecordResponse {
  return { ...t, amount: Number(t.amount ?? 0) };
}

export async function getTransactions(
  userId: number,
  query: TransactionQueryDto = {},
): Promise<PaginatedTransactions> {
  const { data } = await apiClient.get<
    PaginatedTransactions | TransactionRecordResponse[]
  >(`/users/${userId}/transactions`, {
    params: query,
    preservePaginated: true,
  });
  // El interceptor devuelve `{ data, total }` o un arreglo desnudo según lo
  // que mande el backend — normalizar defensivamente (ver `unwrapList`).
  const items = Array.isArray(data)
    ? data
    : unwrapList<TransactionRecordResponse>(
        data as { data: TransactionRecordResponse[]; total?: number },
      );
  const total = Array.isArray(data)
    ? data.length
    : Number((data as { total?: number }).total ?? items.length);
  return { data: items.map(normalizeTransaction), total };
}

function toAmounts<T extends object>(v: T | undefined): T & TransactionSummaryAmounts {
  const a = (v ?? {}) as Partial<TransactionSummaryAmounts>;
  return {
    ...(v as T),
    income: Number(a.income ?? 0),
    expenses: Number(a.expenses ?? 0),
    investments: Number(a.investments ?? 0),
    count: Number(a.count ?? 0),
  };
}

/**
 * El API manda el resumen como `data: [summary]` y el interceptor deja el
 * arreglo: leer `.totals` directo sobre él daba todo en 0. Montos numeric de
 * Postgres llegan como string → Number.
 */
export async function getTransactionSummary(
  userId: number,
  query: TransactionSummaryQuery,
): Promise<TransactionSummary> {
  const { data } = await apiClient.get<TransactionSummary | TransactionSummary[]>(
    `/users/${userId}/transactions/summary`,
    { params: query },
  );
  const s = (Array.isArray(data) ? data[0] : data) as Partial<TransactionSummary> | undefined;
  return {
    group_by: s?.group_by ?? query.group_by,
    totals: toAmounts(s?.totals),
    series: (s?.series ?? []).map(toAmounts),
    by_category: (s?.by_category ?? []).map(toAmounts),
  };
}

export async function getTransaction(
  userId: number,
  id: number,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.get<
    TransactionRecordResponse | TransactionRecordResponse[]
  >(`/users/${userId}/transactions/${id}`);
  return normalizeTransaction(Array.isArray(data) ? data[0] : data);
}

export async function createTransaction(
  userId: number,
  dto: CreateTransactionRecordDto,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.post<
    TransactionRecordResponse | TransactionRecordResponse[]
  >(`/users/${userId}/transactions`, dto);
  return normalizeTransaction(Array.isArray(data) ? data[0] : data);
}

export async function updateTransaction(
  userId: number,
  id: number,
  dto: UpdateTransactionRecordDto,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.patch<
    TransactionRecordResponse | TransactionRecordResponse[]
  >(`/users/${userId}/transactions/${id}`, dto);
  return normalizeTransaction(Array.isArray(data) ? data[0] : data);
}

export async function deleteTransaction(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/transactions/${id}`);
}

/**
 * Duplica una transacción existente en el servidor. Requiere conexión: solo
 * tiene sentido sobre una transacción que ya existe con id de servidor (no
 * aplica a transacciones creadas offline que todavía no sincronizan).
 */
export async function cloneTransaction(
  userId: number,
  id: number,
  dto: CloneTransactionDto = {},
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.post<
    TransactionRecordResponse | TransactionRecordResponse[]
  >(`/users/${userId}/transactions/${id}/clone`, dto);
  return normalizeTransaction(Array.isArray(data) ? data[0] : data);
}
