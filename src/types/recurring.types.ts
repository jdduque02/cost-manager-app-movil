import type { PaymentMethod, TransactionType } from "./transaction.types";

export type RecurringFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

/** `auto` registra el movimiento; `confirm` lo deja "por validar". */
export type RecurringMode = "auto" | "confirm";

export type RecurringStatus = "active" | "cancelled" | "finished";

/** Montos crudos: se formatean solo en la UI (R8.3). */
export interface RecurringTransaction {
  id: number;
  name: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: number | null;
  subcategory_id: number | null;
  account_id: number | null;
  liability_id: number | null;
  origin_account_id: number | null;
  destination_account_id: number | null;
  destination_liability_id: number | null;
  payment_method: PaymentMethod | null;
  frequency: RecurringFrequency;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_count: number;
  /** `null` si no tiene tope de ocurrencias. */
  remaining_occurrences: number | null;
  mode: RecurringMode;
  reminder_days: number;
  status: RecurringStatus;
  pending_validation_count: number;
  created_at: string;
}

/**
 * `transfer`: `origin_account_id` y un destino (`destination_account_id` o
 * `destination_liability_id`). Los demás tipos: `account_id` o `liability_id`.
 * `end_date` y `max_occurrences` son excluyentes.
 */
export interface CreateRecurringTransactionDto {
  name: string;
  type: TransactionType;
  amount: number;
  /** Solo efectivo en `income` (otro tipo con moneda distinta del producto: 400). Sin él, la del producto. El API convierte con TRM. */
  currency?: "COP" | "USD";
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  liability_id?: number;
  origin_account_id?: number;
  destination_account_id?: number;
  destination_liability_id?: number;
  payment_method?: PaymentMethod;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  max_occurrences?: number;
  mode: RecurringMode;
  reminder_days?: number;
}

/** `type`, `frequency`, `start_date` y destinos de transferencia no se editan (400). */
export type UpdateRecurringTransactionDto = Partial<
  Omit<
    CreateRecurringTransactionDto,
    | "type"
    | "frequency"
    | "start_date"
    | "destination_account_id"
    | "destination_liability_id"
    | "account_id"
    | "liability_id"
    | "end_date"
    | "max_occurrences"
    | "category_id"
    | "subcategory_id"
  >
> & {
  // `null` desliga cuenta/pasivo/categoría; `end_date` y `max_occurrences` en `null` dejan la regla sin fin.
  category_id?: number | null;
  subcategory_id?: number | null;
  account_id?: number | null;
  liability_id?: number | null;
  end_date?: string | null;
  max_occurrences?: number | null;
};

export interface RecurringProcessResult {
  created: number;
  reminders: number;
  adopted: number;
}

export interface ValidateRecurringTransactionDto {
  /** `YYYY-MM-DD`, no futura. */
  transaction_date: string;
  /** Monto real; sin él se conserva el generado. */
  amount?: number;
}
