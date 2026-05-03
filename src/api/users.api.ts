import { apiClient } from "./client";
import type {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
  FinancialProfileResponse,
  CreateFinancialProfileDto,
} from "@/types/user.types";

export async function createUser(dto: CreateUserDto): Promise<UserResponse> {
  const { data } = await apiClient.post<UserResponse>("/user", dto);
  return data;
}

export async function getCurrentUser(userId: number): Promise<UserResponse> {
  const { data } = await apiClient.get<UserResponse>(`/user/${userId}`);
  return data;
}

export async function updateUser(
  userId: number,
  dto: UpdateUserDto,
): Promise<UserResponse> {
  const { data } = await apiClient.patch<UserResponse>(`/user/${userId}`, dto);
  return data;
}

export async function getFinancialProfile(
  userId: number,
): Promise<FinancialProfileResponse> {
  const { data } = await apiClient.get<FinancialProfileResponse>(
    `/user/${userId}/financial-profile`,
  );
  return data;
}

export async function createFinancialProfile(
  userId: number,
  dto: CreateFinancialProfileDto,
): Promise<FinancialProfileResponse> {
  const { data } = await apiClient.post<FinancialProfileResponse>(
    `/user/${userId}/financial-profile`,
    dto,
  );
  return data;
}
