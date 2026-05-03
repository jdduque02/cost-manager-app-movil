import { apiClient } from "./client";
import type {
  FinancialObjectiveResponse,
  CreateFinancialObjectiveDto,
  UpdateFinancialObjectiveDto,
  FinancialPeriodResponse,
  ObjectivePaymentResponse,
} from "@/types/objective.types";

// --- Financial Objectives ---
export async function getObjectives(
  userId: number,
): Promise<FinancialObjectiveResponse[]> {
  const { data } = await apiClient.get<FinancialObjectiveResponse[]>(
    `/users/${userId}/financial-objectives`,
  );
  return data;
}

export async function getObjective(
  userId: number,
  id: number,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.get<FinancialObjectiveResponse>(
    `/users/${userId}/financial-objectives/${id}`,
  );
  return data;
}

export async function createObjective(
  userId: number,
  dto: CreateFinancialObjectiveDto,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.post<FinancialObjectiveResponse>(
    `/users/${userId}/financial-objectives`,
    dto,
  );
  return data;
}

export async function updateObjective(
  userId: number,
  id: number,
  dto: UpdateFinancialObjectiveDto,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.patch<FinancialObjectiveResponse>(
    `/users/${userId}/financial-objectives/${id}`,
    dto,
  );
  return data;
}

export async function deleteObjective(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/financial-objectives/${id}`);
}

// --- Financial Periods ---
export async function getFinancialPeriods(
  userId: number,
): Promise<FinancialPeriodResponse[]> {
  const { data } = await apiClient.get<FinancialPeriodResponse[]>(
    `/users/${userId}/financial-periods`,
  );
  return data;
}

// --- Objective Payments ---
export async function getObjectivePayments(
  userId: number,
  objectiveId: number,
): Promise<ObjectivePaymentResponse[]> {
  const { data } = await apiClient.get<ObjectivePaymentResponse[]>(
    `/users/${userId}/financial-objectives/${objectiveId}/payments`,
  );
  return data;
}

export async function createObjectivePayment(
  userId: number,
  objectiveId: number,
  amount: number,
  notes?: string,
): Promise<ObjectivePaymentResponse> {
  const { data } = await apiClient.post<ObjectivePaymentResponse>(
    `/users/${userId}/financial-objectives/${objectiveId}/payments`,
    { amount, notes },
  );
  return data;
}
