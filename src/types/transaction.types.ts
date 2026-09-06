export type TransactionType = "income" | "expense" | "investment" | "transfer";

export interface TransactionRecordResponse {
  id: number;
  user_id: number;
  category_id: number | null;
  subcategory_id?: number | null;
  account_id?: number | null;
  type: TransactionType;
  amount: number;
  currency: string;
  is_fixed: boolean;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateTransactionRecordDto {
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  type: TransactionType;
  amount: number;
  currency?: string;
  description?: string;
  transaction_date?: string;
}

export type UpdateTransactionRecordDto = Partial<CreateTransactionRecordDto>;

export interface TransactionQueryDto {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  type?: TransactionType;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: TransactionRecordResponse[];
  total: number;
}
