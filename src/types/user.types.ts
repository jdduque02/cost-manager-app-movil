export interface UserResponse {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  keycloakId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface FinancialProfileResponse {
  id: number;
  userId: number;
  monthlyIncome: number;
  currency: string;
  savingsGoalPercentage: number;
  riskTolerance: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialProfileDto {
  monthlyIncome: number;
  currency: string;
  savingsGoalPercentage?: number;
  riskTolerance?: string;
}
