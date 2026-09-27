import { apiClient, isListPayload, unwrapList } from "./client";
import * as localRepo from "@/database/local.repository";
import type {
  EmpresaResponse,
  CreateEmpresaDto,
  UpdateEmpresaDto,
} from "@/types/empresa.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

export async function getEmpresas(userId: number): Promise<EmpresaResponse[]> {
  // Lista completa (sin paginar): snapshot previo para podar lo borrado en otro
  // dispositivo (ver "Poda del caché" en local.repository.ts).
  const before = await localRepo.getCachedIds("companies", userId).catch(() => undefined);
  const { data } = await apiClient.get<
    EmpresaResponse[] | { data: EmpresaResponse[]; total?: number }
  >(`/users/${userId}/empresas`);
  const empresas = unwrapList(data);
  await localRepo
    .saveCompanies(empresas, isListPayload(data) ? before : undefined)
    .catch(() => {});
  return empresas;
}

export async function createEmpresa(
  userId: number,
  dto: CreateEmpresaDto,
): Promise<EmpresaResponse> {
  const { data } = await apiClient.post<EmpresaResponse | EmpresaResponse[]>(
    `/users/${userId}/empresas`,
    dto,
  );
  const empresa = one(data);
  await localRepo.saveCompanies([empresa]).catch(() => {});
  return empresa;
}

export async function updateEmpresa(
  userId: number,
  id: number,
  dto: UpdateEmpresaDto,
): Promise<EmpresaResponse> {
  const { data } = await apiClient.patch<EmpresaResponse | EmpresaResponse[]>(
    `/users/${userId}/empresas/${id}`,
    dto,
  );
  return one(data);
}

export async function deleteEmpresa(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/empresas/${id}`);
}
