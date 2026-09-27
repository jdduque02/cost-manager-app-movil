export type FinancialObjectiveType =
  | "loan"
  | "savings"
  | "goal"
  | "emergency_fund";

export interface FinancialObjectiveResponse {
  id: number;
  user_id: number;
  name: string;
  type: FinancialObjectiveType;
  target_amount: number | null;
  current_balance: number;
  start_date?: string | null;
  end_date?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string | null;
  /**
   * Solo se calcula por el backend cuando type=emergency_fund
   * (balance actual / gasto mensual promedio de los últimos 3 meses).
   * null/undefined para los demás tipos.
   */
  months_of_expenses_covered?: number | null;
  /**
   * Solo presente en lecturas offline desde SQLite (src/database/local.repository.ts):
   * indica que el registro tiene cambios pendientes de sincronizar. Las respuestas
   * que vienen directo del backend (unwrapEnvelope/unwrapList) nunca lo traen.
   */
  is_pending_sync?: boolean;
}

export interface CreateFinancialObjectiveDto {
  name: string;
  type: FinancialObjectiveType;
  target_amount?: number | null;
  current_balance?: number;
  start_date?: string;
  end_date?: string;
}

export type UpdateFinancialObjectiveDto = Partial<CreateFinancialObjectiveDto>;

export interface FinancialPeriodResponse {
  id: number;
  user_id: number;
  year: number;
  month: number;
  is_closed: boolean;
  closed_at?: string | null;
  created_at: string;
}

export interface ObjectivePaymentResponse {
  id: number;
  objective_id: number;
  user_id: number;
  amount: number;
  payment_date: string;
  note?: string;
  created_at: string;
}
