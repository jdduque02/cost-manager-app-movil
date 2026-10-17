/**
 * CategoriesScreen (categorias-por-usuario, RF-13): marca las de sistema,
 * mantiene el filtro por group_type, muestra el mensaje del API en 409/400 y
 * ata la queryKey al usuario.
 */
import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CategoriesScreen from "../CategoriesScreen";
import * as catalogApi from "@/api/catalog.api";
import { toast } from "@/utils/toast";
import type { CategoryResponse } from "@/types/catalog.types";

let mockCategories: CategoryResponse[] = [];
const mockQueryKeys: unknown[] = [];
const mockInvalidate = jest.fn();

jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ userId: 7 }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@/hooks/useOfflineQuery", () => ({
  useOfflineQuery: (options: { queryKey: unknown }) => {
    mockQueryKeys.push(options.queryKey);
    const isCategories = (options.queryKey as unknown[])[0] === "categories";
    return { data: isCategories ? mockCategories : [], isLoading: false, refetch: jest.fn() };
  },
}));
jest.mock("@/components/ThemeProvider", () => ({
  useAppTheme: () => ({ resolvedScheme: "light" }),
}));
jest.mock("@/api/catalog.api", () => ({
  getCategories: jest.fn(),
  getSubcategories: jest.fn(),
  createCategory: jest.fn(),
  createSubcategory: jest.fn(),
}));
jest.mock("@/database/local.repository", () => ({
  getLocalCategories: jest.fn(),
  getLocalSubcategories: jest.fn(),
}));
jest.mock("@/utils/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function category(id: number, name: string, group_type: CategoryResponse["group_type"], is_system: boolean) {
  return {
    id,
    name,
    group_type,
    sort_order: 0,
    is_active: true,
    is_system,
    created_at: "",
  } as CategoryResponse;
}

function apiError(status: number, message: string) {
  return Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, data: { message, timestamp: "t" } },
  });
}

/** Abre el modal, escribe el nombre y confirma el Alert de "Crear". */
async function submitCategory(name: string) {
  fireEvent.press(screen.getAllByText("Nueva")[0]);
  fireEvent.changeText(screen.getByPlaceholderText("Transporte"), name);
  fireEvent.press(screen.getAllByText("Crear")[0]);
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2] as {
    text: string;
    onPress?: () => Promise<void>;
  }[];
  await buttons.find((b) => b.text === "Crear")!.onPress!();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryKeys.length = 0;
  mockCategories = [
    category(1, "Alimentación", "expense", true),
    category(2, "Mascotas", "expense", false),
    category(3, "Salario", "income", true),
  ];
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

it("marca con Badge 'Sistema' solo las categorías is_system", () => {
  render(<CategoriesScreen />);
  expect(screen.getAllByText("Sistema")).toHaveLength(2);
  expect(screen.getByText("Mascotas")).toBeTruthy();
});

it("el filtro por group_type se mantiene", () => {
  render(<CategoriesScreen />);
  fireEvent.press(screen.getAllByText("Ingreso")[0]);
  expect(screen.queryByText("Mascotas")).toBeNull();
  expect(screen.getByText("Salario")).toBeTruthy();
});

it("ata la queryKey de categorías al usuario", () => {
  render(<CategoriesScreen />);
  expect(mockQueryKeys).toContainEqual(["categories", 7]);
});

it("409 muestra el mensaje de duplicado del API", async () => {
  (catalogApi.createCategory as jest.Mock).mockRejectedValue(
    apiError(409, "Ya existe una categoría con ese nombre"),
  );
  render(<CategoriesScreen />);
  await submitCategory("Mascotas");
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Ya existe una categoría con ese nombre"),
  );
});

it("400 muestra el mensaje del API", async () => {
  (catalogApi.createCategory as jest.Mock).mockRejectedValue(
    apiError(400, "El nombre no puede estar vacío"),
  );
  render(<CategoriesScreen />);
  await submitCategory("x");
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("El nombre no puede estar vacío"),
  );
});

it("sin mensaje del API cae al genérico", async () => {
  (catalogApi.createCategory as jest.Mock).mockRejectedValue(new Error(""));
  render(<CategoriesScreen />);
  await submitCategory("x");
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo crear la categoría"));
});

it("crear con éxito invalida por prefijo ['categories']", async () => {
  (catalogApi.createCategory as jest.Mock).mockResolvedValue(category(9, "Nueva", "expense", false));
  render(<CategoriesScreen />);
  await submitCategory("Nueva");
  await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["categories"] }));
});
