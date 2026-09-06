export interface UserResponse {
  id: number;
  external_id?: string;
  username: string;
  email: string;
  locale?: string;
  timezone?: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  document_id?: string | null;
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  document_id?: string;
  locale?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateUserDto = Partial<
  Pick<
    UserResponse,
    | "username"
    | "email"
    | "locale"
    | "timezone"
    | "full_name"
    | "phone"
    | "address"
    | "document_id"
    | "metadata"
  >
>;

export interface FinancialProfileResponse {
  id: number;
  profile_name: string;
  is_custom: boolean;
  needs_ratio: number;
  wants_ratio: number;
  savings_ratio: number;
  investment_ratio: number;
  max_debt_ratio: number;
  monthly_income?: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateFinancialProfileDto {
  profile_name?: string;
  is_custom?: boolean;
  needs_ratio?: number;
  wants_ratio?: number;
  savings_ratio?: number;
  investment_ratio?: number;
  max_debt_ratio?: number;
  monthly_income?: number;
}
