export type AccountType =
  | "ahorros"
  | "corriente"
  | "inversion"
  | "cdt"
  | "ahorro_alto_rendimiento"
  | "fna"
  | "aporte_pension_voluntaria"
  | "otro";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
  inversion: "Inversión",
  cdt: "CDT / Inversión",
  ahorro_alto_rendimiento: "Cuenta de ahorro de alto rendimiento",
  fna: "FNA - Fondo Nacional del Ahorro",
  aporte_pension_voluntaria: "Aporte Pensión Voluntaria",
  otro: "Otro",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? type.replace(/_/g, " ");
}

export interface BankAccountResponse {
  id: number;
  user_id: number;
  bank_name: string;
  account_type: AccountType;
  masked_account_number: string;
  display_balance: string;
  currency: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface CreateBankAccountDto {
  bank_name: string;
  account_type: AccountType;
  account_number: string;
  balance: number;
  currency?: string;
  is_primary?: boolean;
}

export type UpdateBankAccountDto = Partial<CreateBankAccountDto>;

export type AssetType =
  | "acciones"
  | "acciones_fraccion"
  | "ahorro_alto_rendimiento"
  | "bienes_raices"
  | "bienes_materiales"
  | "vehiculos"
  | "joyas_metales"
  | "arte_colecciones"
  | "propiedad_intelectual"
  | "fondos_inversion"
  | "cryptomonedas"
  | "efectivo"
  | "otro";

export interface FinancialAssetResponse {
  id: number;
  user_id: number;
  asset_type: AssetType;
  name: string;
  current_value: number;
  current_yield?: number | null;
  currency: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateFinancialAssetDto {
  asset_type: AssetType;
  name: string;
  current_value: number;
  current_yield?: number;
  currency?: string;
}

export type LiabilityType =
  | "credito_hipotecario"
  | "credito_consumo"
  | "tarjeta_credito"
  | "prestamo_personal"
  | "otro";

export interface FinancialLiabilityResponse {
  id: number;
  user_id: number;
  liability_type: LiabilityType;
  name: string;
  current_balance: number;
  interest_rate?: number;
  currency: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateFinancialLiabilityDto {
  liability_type: LiabilityType;
  name: string;
  current_balance: number;
  interest_rate?: number;
  currency?: string;
}
