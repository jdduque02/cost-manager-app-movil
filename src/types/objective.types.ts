export interface FinancialObjectiveResponse {
  id: number;
  userId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string;
  description: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialObjectiveDto {
  name: string;
  targetAmount: number;
  currency: string;
  targetDate: string;
  description?: string;
}

export interface UpdateFinancialObjectiveDto {
  name?: string;
  targetAmount?: number;
  currency?: string;
  targetDate?: string;
  description?: string;
}

export interface FinancialPeriodResponse {
  id: number;
  userId: number;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectivePaymentResponse {
  id: number;
  objectiveId: number;
  amount: number;
  currency: string;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
}
