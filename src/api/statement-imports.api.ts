import { apiClient } from "./client";
import type { StatementImportRecord } from "@/types/statement-import.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

export async function getStatementImports(
  userId: number,
  page = 1,
  limit = 20,
): Promise<{ data: StatementImportRecord[]; total: number }> {
  const { data } = await apiClient.get<{
    data: StatementImportRecord[];
    total: number;
  }>(`/users/${userId}/statement-imports`, {
    params: { page, limit },
    preservePaginated: true,
  });
  return data;
}

export async function getStatementImport(
  userId: number,
  id: number,
): Promise<StatementImportRecord> {
  const { data } = await apiClient.get<
    StatementImportRecord | StatementImportRecord[]
  >(`/users/${userId}/statement-imports/${id}`);
  return one(data);
}

export async function uploadStatementImport(
  userId: number,
  files: { uri: string; name: string; mimeType: string }[],
  options: {
    password?: string;
    defaultCategoryId?: number;
    accountId?: number;
    skipDuplicates?: boolean;
    defaultType?: "income" | "expense" | "investment";
  },
): Promise<StatementImportRecord> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  });

  if (options.password) formData.append("password", options.password);
  if (options.defaultCategoryId)
    formData.append("default_category_id", String(options.defaultCategoryId));
  if (options.accountId)
    formData.append("account_id", String(options.accountId));
  if (options.skipDuplicates !== undefined)
    formData.append("skip_duplicates", String(options.skipDuplicates));
  if (options.defaultType)
    formData.append("default_type", options.defaultType);

  const { data } = await apiClient.post<
    StatementImportRecord | StatementImportRecord[]
  >(`/users/${userId}/statement-imports`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return one(data);
}

export async function retryStatementImport(
  userId: number,
  id: number,
  password?: string,
): Promise<StatementImportRecord> {
  const { data } = await apiClient.post<
    StatementImportRecord | StatementImportRecord[]
  >(`/users/${userId}/statement-imports/${id}/retry`, password ? { password } : {});
  return one(data);
}
