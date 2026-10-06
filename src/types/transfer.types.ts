import type { FixedType, FixedFrequency } from "./transaction.types";

/** Una transferencia es un modelo separado en el backend (no un tipo de transacción normal). */
export interface CreateTransferDto {
  source_account_id: number;
  destination_account_id?: number;
  destination_liability_id?: number;
  amount: number;
  transaction_date?: string;
  description?: string;
  is_fixed?: boolean;
  fixed_type?: FixedType;
  frequency?: FixedFrequency;
  due_day?: number;
  reminder_days?: number;
  objective_id?: number;
  company_id?: number;
}

export interface TransferMovement {
  id: number;
  account_id: number | null;
  liability_id: number | null;
  side: "source" | "destination";
  /** El monto de la transferencia va en la moneda del origen; la pierna destino trae el convertido. */
  amount: number;
  currency: string;
  applied_amount: number | null;
  fx_rate: number | null;
  transaction_date: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TransferResponse {
  transfer_group_id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  is_fixed?: boolean;
  frequency?: FixedFrequency | null;
  fixed_type?: FixedType | null;
  due_day?: number | null;
  reminder_days?: number | null;
  source: TransferMovement;
  destination: TransferMovement;
}
