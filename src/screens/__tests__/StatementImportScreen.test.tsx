/**
 * Los switches del modal llegan a la subida. La transición de imports que
 * refresca transacciones/empresas se prueba en useStatementImports.test.tsx.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import StatementImportScreen from "../StatementImportScreen";
import * as statementApi from "@/api/statement-imports.api";

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (opts: { mutationFn: (v?: unknown) => Promise<unknown> }) => ({
    mutate: (v?: unknown) => opts.mutationFn(v),
    isPending: false,
  }),
}));
jest.mock("@/api/statement-imports.api", () => ({
  uploadStatementImport: jest.fn().mockResolvedValue({ id: 9, status: "pending" }),
}));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: { userId: number }) => unknown) => sel({ userId: 7 }),
}));
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: (sel: (s: { isOnline: boolean }) => unknown) => sel({ isOnline: true }),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const mockUseQuery = useQuery as jest.Mock;

function withImports(rows: unknown[]) {
  mockUseQuery.mockReturnValue({
    data: { data: rows, total: rows.length },
    isLoading: false,
    refetch: jest.fn(),
    isRefetching: false,
  });
}

beforeEach(() => jest.clearAllMocks());

it("los switches activos por defecto y su valor viajan en la subida", async () => {
  withImports([]);
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///a.pdf", name: "a.pdf", mimeType: "application/pdf" }],
  });
  render(<StatementImportScreen />);
  fireEvent.press(screen.getByText("Seleccionar PDFs"));

  const capture = await screen.findByLabelText("Capturar y registrar empresas");
  expect(screen.getByLabelText("Auto-categorizar").props.value).toBe(true);
  expect(capture.props.value).toBe(true);
  fireEvent(capture, "valueChange", false);
  fireEvent.press(screen.getByText("Subir 1 archivo"));

  expect(statementApi.uploadStatementImport).toHaveBeenCalledWith(
    7,
    expect.any(Array),
    expect.objectContaining({ assignCategories: true, captureCompanies: false }),
  );
});
