import { apiClient } from "./client";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
  TransactionQueryDto,
  PaginatedTransactions,
} from "@/types/transaction.types";

export async function getTransactions(
  userId: number,
  query: TransactionQueryDto = {},
): Promise<PaginatedTransactions> {
  const { data } = await apiClient.get<PaginatedTransactions>(
    `/users/${userId}/transactions`,
    { params: query },
  );
  return data;
}

export async function getTransaction(
  userId: number,
  id: number,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.get<TransactionRecordResponse>(
    `/users/${userId}/transactions/${id}`,
  );
  return data;
}

export async function createTransaction(
  userId: number,
  dto: CreateTransactionRecordDto,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.post<TransactionRecordResponse>(
    `/users/${userId}/transactions`,
    dto,
  );
  return data;
}

export async function updateTransaction(
  userId: number,
  id: number,
  dto: UpdateTransactionRecordDto,
): Promise<TransactionRecordResponse> {
  const { data } = await apiClient.patch<TransactionRecordResponse>(
    `/users/${userId}/transactions/${id}`,
    dto,
  );
  return data;
}

export async function deleteTransaction(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/transactions/${id}`);
}
