import { apiClient } from "./client";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  FinancialAssetResponse,
  FinancialLiabilityResponse,
} from "@/types/banking.types";

// --- Bank Accounts ---
export async function getBankAccounts(
  userId: number,
): Promise<BankAccountResponse[]> {
  const { data } = await apiClient.get<BankAccountResponse[]>(
    `/users/${userId}/bank-accounts`,
  );
  return data;
}

export async function getBankAccount(
  userId: number,
  id: number,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.get<BankAccountResponse>(
    `/users/${userId}/bank-accounts/${id}`,
  );
  return data;
}

export async function createBankAccount(
  userId: number,
  dto: CreateBankAccountDto,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.post<BankAccountResponse>(
    `/users/${userId}/bank-accounts`,
    dto,
  );
  return data;
}

export async function updateBankAccount(
  userId: number,
  id: number,
  dto: UpdateBankAccountDto,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.patch<BankAccountResponse>(
    `/users/${userId}/bank-accounts/${id}`,
    dto,
  );
  return data;
}

export async function deleteBankAccount(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/bank-accounts/${id}`);
}

// --- Financial Assets ---
export async function getFinancialAssets(
  userId: number,
): Promise<FinancialAssetResponse[]> {
  const { data } = await apiClient.get<FinancialAssetResponse[]>(
    `/users/${userId}/financial-assets`,
  );
  return data;
}

// --- Financial Liabilities ---
export async function getFinancialLiabilities(
  userId: number,
): Promise<FinancialLiabilityResponse[]> {
  const { data } = await apiClient.get<FinancialLiabilityResponse[]>(
    `/users/${userId}/financial-liabilities`,
  );
  return data;
}
