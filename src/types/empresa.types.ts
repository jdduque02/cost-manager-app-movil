export interface EmpresaResponse {
  id: number;
  user_id: number;
  name: string;
  default_category_id?: number | null;
  created_at: string;
  updated_at: string | null;
  /**
   * Solo presente en lecturas offline desde SQLite (src/database/local.repository.ts):
   * indica que el registro tiene cambios pendientes de sincronizar. Las respuestas
   * que vienen directo del backend (unwrapEnvelope/unwrapList) nunca lo traen.
   */
  is_pending_sync?: boolean;
}

export interface CreateEmpresaDto {
  name: string;
  default_category_id?: number;
}

export type UpdateEmpresaDto = Partial<CreateEmpresaDto>;
