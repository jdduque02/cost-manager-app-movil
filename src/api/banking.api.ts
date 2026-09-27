import { apiClient, isListPayload, unwrapList } from "./client";
import * as localRepo from "@/database/local.repository";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  FinancialAssetResponse,
  FinancialLiabilityResponse,
} from "@/types/banking.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

// --- Bank Accounts ---
export async function getBankAccounts(
  userId: number,
): Promise<BankAccountResponse[]> {
  // Lista completa (sin paginar): snapshot previo para podar lo borrado en otro
  // dispositivo (ver "Poda del caché" en local.repository.ts).
  const before = await localRepo.getCachedIds("bank_accounts", userId).catch(() => undefined);
  const { data } = await apiClient.get<
    BankAccountResponse[] | { data: BankAccountResponse[]; total?: number }
  >(`/users/${userId}/bank-accounts`);
  const accounts = unwrapList(data);
  await localRepo
    .saveBankAccounts(accounts, isListPayload(data) ? before : undefined)
    .catch(() => {});
  return accounts;
}

export async function getBankAccount(
  userId: number,
  id: number,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.get<
    BankAccountResponse | BankAccountResponse[]
  >(`/users/${userId}/bank-accounts/${id}`);
  return one(data);
}

export async function createBankAccount(
  userId: number,
  dto: CreateBankAccountDto,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.post<
    BankAccountResponse | BankAccountResponse[]
  >(`/users/${userId}/bank-accounts`, dto);
  return one(data);
}

export async function updateBankAccount(
  userId: number,
  id: number,
  dto: UpdateBankAccountDto,
): Promise<BankAccountResponse> {
  const { data } = await apiClient.patch<
    BankAccountResponse | BankAccountResponse[]
  >(`/users/${userId}/bank-accounts/${id}`, dto);
  return one(data);
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
  const before = await localRepo.getCachedIds("financial_assets", userId).catch(() => undefined);
  const { data } = await apiClient.get<
    FinancialAssetResponse[] | { data: FinancialAssetResponse[]; total?: number }
  >(`/users/${userId}/financial-assets`);
  const assets = unwrapList(data).map((a) => ({
    ...a,
    current_value: Number(a.current_value ?? 0),
    current_yield: a.current_yield != null ? Number(a.current_yield) : null,
  }));
  await localRepo
    .saveFinancialAssets(assets, isListPayload(data) ? before : undefined)
    .catch(() => {});
  return assets;
}

// --- Financial Liabilities ---
export async function getFinancialLiabilities(
  userId: number,
): Promise<FinancialLiabilityResponse[]> {
  const before = await localRepo.getCachedIds("financial_liabilities", userId).catch(() => undefined);
  const { data } = await apiClient.get<
    FinancialLiabilityResponse[] | { data: FinancialLiabilityResponse[]; total?: number }
  >(`/users/${userId}/financial-liabilities`);
  const liabilities = unwrapList(data).map((l) => ({
    ...l,
    current_balance: Number(l.current_balance ?? 0),
  }));
  await localRepo
    .saveFinancialLiabilities(liabilities, isListPayload(data) ? before : undefined)
    .catch(() => {});
  return liabilities;
}
