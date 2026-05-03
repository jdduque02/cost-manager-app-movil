export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export interface TransactionRecordResponse {
  id: number;
  userId: number;
  categoryId: number;
  subcategoryId: number | null;
  bankAccountId: number | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRecordDto {
  categoryId: number;
  subcategoryId?: number;
  bankAccountId?: number;
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string;
  transactionDate: string;
}

export interface UpdateTransactionRecordDto {
  categoryId?: number;
  subcategoryId?: number;
  bankAccountId?: number;
  type?: TransactionType;
  amount?: number;
  currency?: string;
  description?: string;
  transactionDate?: string;
}

export interface TransactionQueryDto {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  subcategory_id?: number;
  type?: TransactionType;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: TransactionRecordResponse[];
  total: number;
}
