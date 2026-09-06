export interface EmpresaResponse {
  id: number;
  user_id: number;
  name: string;
  default_category_id?: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateEmpresaDto {
  name: string;
  default_category_id?: number;
}

export type UpdateEmpresaDto = Partial<CreateEmpresaDto>;
