import { apiClient } from "./client";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
  TransactionQueryDto,
  PaginatedTransactions,
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
  const { data } = await apiClient.get<PaginatedTransactions>(
    `/users/${userId}/transactions`,
    { params: query, preservePaginated: true },
  );
  return { ...data, data: data.data.map(normalizeTransaction) };
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
