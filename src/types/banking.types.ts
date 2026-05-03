export interface BankAccountResponse {
  id: number;
  userId: number;
  name: string;
  bankName: string;
  accountType: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountDto {
  name: string;
  bankName: string;
  accountType: string;
  balance: number;
  currency: string;
}

export interface UpdateBankAccountDto {
  name?: string;
  bankName?: string;
  accountType?: string;
  balance?: number;
  currency?: string;
  isActive?: boolean;
}

export interface FinancialAssetResponse {
  id: number;
  userId: number;
  name: string;
  assetType: string;
  currentValue: number;
  currency: string;
  acquisitionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialLiabilityResponse {
  id: number;
  userId: number;
  name: string;
  liabilityType: string;
  totalAmount: number;
  remainingBalance: number;
  interestRate: number;
  currency: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}
