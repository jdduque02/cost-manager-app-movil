import { apiClient } from "./client";
import type { CreateTransferDto, TransferResponse } from "@/types/transfer.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Transferencias entre cuentas/pasivos: endpoint y modelo separados de
 * /transactions (ver TransferDialog.tsx en la web). No tienen soporte
 * offline todavía — requieren conexión, igual que el borrado de
 * transacciones (ver confirmDelete en app/(tabs)/transactions.tsx).
 */
export async function createTransfer(
  userId: number,
  dto: CreateTransferDto,
): Promise<TransferResponse> {
  const { data } = await apiClient.post<TransferResponse | TransferResponse[]>(
    `/users/${userId}/transfers`,
    dto,
  );
  return one(data);
}
