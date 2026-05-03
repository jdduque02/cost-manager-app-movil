import { apiClient } from "./client";
import type {
  CategoryResponse,
  SubcategoryResponse,
} from "@/types/catalog.types";

export async function getCategories(): Promise<CategoryResponse[]> {
  const { data } = await apiClient.get<CategoryResponse[]>(
    "/catalog/categories",
  );
  return data;
}

export async function getSubcategories(
  categoryId: number,
): Promise<SubcategoryResponse[]> {
  const { data } = await apiClient.get<SubcategoryResponse[]>(
    `/catalog/categories/${categoryId}/subcategories`,
  );
  return data;
}
