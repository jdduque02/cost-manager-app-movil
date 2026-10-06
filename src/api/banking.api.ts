import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient, isListPayload, unwrapList } from "./client";
import * as localRepo from "@/database/local.repository";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  FinancialAssetResponse,
  FinancialLiabilityResponse,
} from "@/types/banking.types";

/** GET /currency/trm: TRM oficial (COP por 1 USD) y su rango de vigencia (YYYY-MM-DD). */
export interface Trm {
  value: number;
  valid_from: string;
  valid_to: string;
  source: string;
}

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

// --- TRM (COP por 1 USD) ---
// Dato público, no sensible: AsyncStorage basta. Se guarda la última para
// consolidar el patrimonio sin conexión (R6.5).
const TRM_STORAGE_KEY = "sprig.trm.last";

const isValidTrm = (t: Partial<Trm> | null | undefined): t is Trm =>
  !!t && Number.isFinite(t.value) && (t.value as number) > 0 && typeof t.valid_from === "string";

/** TRM vigente hoy (Bogotá) desde el API; la guarda como última conocida. */
export async function getTrm(): Promise<Trm> {
  const { data } = await apiClient.get<Trm | Trm[]>("/currency/trm");
  const raw = one(data);
  const trm = { ...raw, value: Number(raw?.value) };
  if (!isValidTrm(trm)) throw new Error("TRM inválida");
  await AsyncStorage.setItem(TRM_STORAGE_KEY, JSON.stringify(trm)).catch(() => {});
  return trm;
}

/** Última TRM obtenida con conexión, o null si nunca se obtuvo (R6.4). */
export async function getCachedTrm(): Promise<Trm | null> {
  try {
    const raw = await AsyncStorage.getItem(TRM_STORAGE_KEY);
    const trm = raw ? (JSON.parse(raw) as Trm) : null;
    return isValidTrm(trm) ? trm : null;
  } catch {
    return null;
  }
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
