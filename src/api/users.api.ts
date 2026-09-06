import { apiClient } from "./client";
import type {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
  FinancialProfileResponse,
  CreateFinancialProfileDto,
} from "@/types/user.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

function normalizeProfile(
  p: FinancialProfileResponse,
): FinancialProfileResponse {
  return {
    ...p,
    needs_ratio: Number(p.needs_ratio ?? 0),
    wants_ratio: Number(p.wants_ratio ?? 0),
    savings_ratio: Number(p.savings_ratio ?? 0),
    investment_ratio: Number(p.investment_ratio ?? 0),
    max_debt_ratio: Number(p.max_debt_ratio ?? 0),
    monthly_income: p.monthly_income != null ? Number(p.monthly_income) : null,
  };
}

export async function createUser(dto: CreateUserDto): Promise<UserResponse> {
  const { data } = await apiClient.post<UserResponse | UserResponse[]>(
    "/user",
    dto,
  );
  return one(data);
}

export async function getCurrentUser(userId: number): Promise<UserResponse> {
  const { data } = await apiClient.get<UserResponse | UserResponse[]>(
    `/user/${userId}`,
  );
  return one(data);
}

export async function updateUser(
  userId: number,
  dto: UpdateUserDto,
): Promise<UserResponse> {
  const { data } = await apiClient.patch<UserResponse | UserResponse[]>(
    `/user/${userId}`,
    dto,
  );
  return one(data);
}

export async function getFinancialProfile(
  userId: number,
): Promise<FinancialProfileResponse> {
  const { data } = await apiClient.get<
    FinancialProfileResponse | FinancialProfileResponse[]
  >(`/user/${userId}/financial-profile`);
  return normalizeProfile(one(data));
}

export async function createFinancialProfile(
  userId: number,
  dto: CreateFinancialProfileDto,
): Promise<FinancialProfileResponse> {
  const { data } = await apiClient.post<
    FinancialProfileResponse | FinancialProfileResponse[]
  >(`/user/${userId}/financial-profile`, dto);
  return normalizeProfile(one(data));
}
