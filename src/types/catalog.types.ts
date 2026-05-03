export interface CategoryResponse {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: "INCOME" | "EXPENSE";
  isSystem: boolean;
  createdAt: string;
}

export interface SubcategoryResponse {
  id: number;
  categoryId: number;
  name: string;
  icon: string | null;
  createdAt: string;
}
