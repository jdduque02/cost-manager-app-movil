import { apiClient, unwrapList } from "./client";
import type {
  FinancialObjectiveResponse,
  CreateFinancialObjectiveDto,
  UpdateFinancialObjectiveDto,
  FinancialPeriodResponse,
  ObjectivePaymentResponse,
} from "@/types/objective.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

function normalizeObjective(
  o: FinancialObjectiveResponse,
): FinancialObjectiveResponse {
  return {
    ...o,
    target_amount: o.target_amount != null ? Number(o.target_amount) : null,
    current_balance: Number(o.current_balance ?? 0),
  };
}

// --- Financial Objectives ---
export async function getObjectives(
  userId: number,
): Promise<FinancialObjectiveResponse[]> {
  const { data } = await apiClient.get<
    FinancialObjectiveResponse[] | { data: FinancialObjectiveResponse[]; total?: number }
  >(`/users/${userId}/financial-objectives`);
  return unwrapList(data).map(normalizeObjective);
}

export async function getObjective(
  userId: number,
  id: number,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.get<
    FinancialObjectiveResponse | FinancialObjectiveResponse[]
  >(`/users/${userId}/financial-objectives/${id}`);
  return normalizeObjective(one(data));
}

export async function createObjective(
  userId: number,
  dto: CreateFinancialObjectiveDto,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.post<
    FinancialObjectiveResponse | FinancialObjectiveResponse[]
  >(`/users/${userId}/financial-objectives`, dto);
  return normalizeObjective(one(data));
}

export async function updateObjective(
  userId: number,
  id: number,
  dto: UpdateFinancialObjectiveDto,
): Promise<FinancialObjectiveResponse> {
  const { data } = await apiClient.patch<
    FinancialObjectiveResponse | FinancialObjectiveResponse[]
  >(`/users/${userId}/financial-objectives/${id}`, dto);
  return normalizeObjective(one(data));
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
  const { data } = await apiClient.get<
    FinancialPeriodResponse[] | { data: FinancialPeriodResponse[]; total?: number }
  >(`/users/${userId}/financial-periods`);
  return unwrapList(data);
}

// --- Objective Payments ---
export async function getObjectivePayments(
  userId: number,
  objectiveId: number,
): Promise<ObjectivePaymentResponse[]> {
  const { data } = await apiClient.get<
    ObjectivePaymentResponse[] | { data: ObjectivePaymentResponse[]; total?: number }
  >(`/users/${userId}/financial-objectives/${objectiveId}/payments`);
  return unwrapList(data).map((p) => ({ ...p, amount: Number(p.amount ?? 0) }));
}

export async function createObjectivePayment(
  userId: number,
  objectiveId: number,
  amount: number,
  paymentDate: string,
  note?: string,
): Promise<ObjectivePaymentResponse> {
  const { data } = await apiClient.post<
    ObjectivePaymentResponse | ObjectivePaymentResponse[]
  >(`/users/${userId}/financial-objectives/${objectiveId}/payments`, {
    objective_id: objectiveId,
    amount,
    payment_date: paymentDate,
    note,
  });
  return one(data);
}
