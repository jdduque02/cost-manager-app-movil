export type TransactionType = "income" | "expense" | "investment" | "transfer";

export type PaymentMethod =
  | "bank_transfer"
  | "cash"
  | "debit_card"
  | "credit_card"
  | "digital_wallet"
  | "mobile_payment";

export type FixedType = "deduction" | "fixed_income";

export type FixedFrequency = "biweekly" | "monthly";

/** A qué "patrimonio" (cuenta/activo/pasivo) se puede asociar una transacción — solo uno a la vez. */
export type PatrimonyKind = "account" | "asset" | "liability";

export interface TransactionRecordResponse {
  id: number;
  user_id: number;
  category_id: number | null;
  subcategory_id?: number | null;
  account_id?: number | null;
  asset_id?: number | null;
  liability_id?: number | null;
  objective_id?: number | null;
  company_id?: number | null;
  type: TransactionType;
  amount: number;
  currency: string;
  payment_method?: PaymentMethod | null;
  is_fixed: boolean;
  fixed_type?: FixedType | null;
  frequency?: FixedFrequency | null;
  due_day?: number | null;
  reminder_days?: number | null;
  installments?: number | null;
  installment_value?: number | null;
  source_bank?: string | null;
  source_account?: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateTransactionRecordDto {
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  asset_id?: number;
  liability_id?: number;
  objective_id?: number;
  company_id?: number;
  type: TransactionType;
  amount: number;
  currency?: string;
  payment_method?: PaymentMethod;
  is_fixed?: boolean;
  fixed_type?: FixedType;
  frequency?: FixedFrequency;
  due_day?: number;
  reminder_days?: number;
  installments?: number;
  installment_value?: number;
  source_bank?: string;
  source_account?: string;
  description?: string;
  transaction_date?: string;
}

export interface UpdateTransactionRecordDto
  extends Partial<CreateTransactionRecordDto> {
  /** Solo aplica en edición: reclasifica todas las transacciones con la misma descripción. */
  apply_to_similar?: boolean;
}

/** Payload opcional para ajustar la transacción clonada antes de crearla (ver POST .../clone). */
export interface CloneTransactionDto {
  transaction_date?: string;
  amount?: number;
  description?: string;
  category_id?: number;
  company_id?: number;
}

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
