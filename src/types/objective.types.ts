export type FinancialObjectiveType = "loan" | "savings" | "goal";

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
