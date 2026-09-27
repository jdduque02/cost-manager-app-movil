export type GroupType = "income" | "expense" | "investment";

export type ProfileBucket = "needs" | "wants" | "savings" | "investment" | "debt";

export const PROFILE_BUCKET_LABELS: Record<ProfileBucket, string> = {
  needs: "Necesidades",
  wants: "Deseos",
  savings: "Ahorro",
  investment: "Inversión",
  debt: "Deuda",
};

export interface CategoryResponse {
  id: number;
  name: string;
  group_type: GroupType;
  profile_bucket?: ProfileBucket | null;
  icon_key?: string | null;
  color_hex?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface SubcategoryResponse {
  id: number;
  user_id: number;
  category_id: number;
  name: string;
  icon_key?: string | null;
  color_hex?: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateCategoryDto {
  name: string;
  group_type: GroupType;
  profile_bucket?: ProfileBucket;
  icon_key?: string;
  color_hex?: string;
  sort_order?: number;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto> & {
  is_active?: boolean;
};

export interface CreateSubcategoryDto {
  category_id: number;
  name: string;
  icon_key?: string;
  color_hex?: string;
}

export interface UpdateSubcategoryDto {
  name?: string;
  icon_key?: string;
  color_hex?: string;
}
