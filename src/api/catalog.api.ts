import { apiClient, unwrapList } from "./client";
import type {
  CategoryResponse,
  SubcategoryResponse,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
} from "@/types/catalog.types";

function one<T>(data: T | T[]): T {
  return Array.isArray(data) ? data[0] : data;
}

export async function getCategories(): Promise<CategoryResponse[]> {
  const { data } = await apiClient.get<
    CategoryResponse[] | { data: CategoryResponse[]; total?: number }
  >("/catalog/categories");
  return unwrapList(data);
}

export async function createCategory(
  dto: CreateCategoryDto,
): Promise<CategoryResponse> {
  const { data } = await apiClient.post<
    CategoryResponse | CategoryResponse[]
  >("/catalog/categories", dto);
  return one(data);
}

export async function updateCategory(
  id: number,
  dto: UpdateCategoryDto,
): Promise<CategoryResponse> {
  const { data } = await apiClient.patch<
    CategoryResponse | CategoryResponse[]
  >(`/catalog/categories/${id}`, dto);
  return one(data);
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/catalog/categories/${id}`);
}

export async function getSubcategories(
  userId: number,
  categoryId?: number,
): Promise<SubcategoryResponse[]> {
  const qs = categoryId ? `?categoryId=${categoryId}` : "";
  const { data } = await apiClient.get<
    SubcategoryResponse[] | { data: SubcategoryResponse[]; total?: number }
  >(`/users/${userId}/catalog/subcategories${qs}`);
  return unwrapList(data);
}

export async function createSubcategory(
  userId: number,
  dto: CreateSubcategoryDto,
): Promise<SubcategoryResponse> {
  const { data } = await apiClient.post<
    SubcategoryResponse | SubcategoryResponse[]
  >(`/users/${userId}/catalog/subcategories`, dto);
  return one(data);
}

export async function updateSubcategory(
  userId: number,
  id: number,
  dto: UpdateSubcategoryDto,
): Promise<SubcategoryResponse> {
  const { data } = await apiClient.patch<
    SubcategoryResponse | SubcategoryResponse[]
  >(`/users/${userId}/catalog/subcategories/${id}`, dto);
  return one(data);
}

export async function deleteSubcategory(
  userId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/users/${userId}/catalog/subcategories/${id}`);
}
