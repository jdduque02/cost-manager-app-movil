/**
 * Watcher del layout raíz: único poller de la lista de imports y quien
 * refresca transacciones/empresas cuando un import en curso termina creando
 * registros, aunque la pantalla de importación ya no esté montada.
 */
import { renderHook } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { useStatementImportsWatcher, markStatementImportInFlight } from "../useStatementImports";

const mockInvalidate = jest.fn();
let mockAuth = { userId: 7 as number | null, isAuthenticated: true, isGuest: false };

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@/api/statement-imports.api", () => ({ getStatementImports: jest.fn() }));
jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: typeof mockAuth) => unknown) => sel(mockAuth),
}));
let mockOnline = true;
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: (sel: (s: { isOnline: boolean }) => unknown) => sel({ isOnline: mockOnline }),
}));

const mockUseQuery = useQuery as jest.Mock;
// `lastStatus` vive en el módulo: cada test usa ids distintos.
const row = (id: number, status: string, created: number) => ({
  id,
  status,
  total_records_created: created,
});
const withImports = (rows: ReturnType<typeof row>[]) =>
  mockUseQuery.mockReturnValue({ data: { data: rows, total: rows.length } });
const invalidatedKeys = () => mockInvalidate.mock.calls.map((c) => c[0].queryKey);
const options = () => mockUseQuery.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { userId: 7, isAuthenticated: true, isGuest: false };
  mockOnline = true;
});

it("sin conexión no consulta y retoma al reconectar", () => {
  withImports([]);
  const loaded = { state: { data: { data: [] } } };
  mockOnline = false;
  const { rerender } = renderHook(() => useStatementImportsWatcher());
  expect(options().enabled(loaded)).toBe(false);

  mockOnline = true;
  rerender({});
  expect(options().enabled(loaded)).toBe(true);
});

it("al pasar de processing a completed con registros invalida transacciones y empresas", () => {
  withImports([row(1, "processing", 2)]);
  const { rerender } = renderHook(() => useStatementImportsWatcher());
  expect(mockInvalidate).not.toHaveBeenCalled();

  withImports([row(1, "completed", 5)]);
  rerender({});

  expect(invalidatedKeys()).toEqual([
    ["transactions", 7],
    ["companies", 7],
    ["empresas", 7],
  ]);
});

it("no invalida si el import ya estaba terminado o no creó registros", () => {
  withImports([row(2, "processing", 0)]);
  const { rerender } = renderHook(() => useStatementImportsWatcher());
  withImports([row(2, "partial", 0)]);
  rerender({});
  withImports([row(2, "completed", 5)]);
  rerender({});

  expect(mockInvalidate).not.toHaveBeenCalled();
});

it("detecta la transición aunque el backend termine antes del siguiente poll", () => {
  withImports([]);
  const { rerender } = renderHook(() => useStatementImportsWatcher());
  markStatementImportInFlight(3);
  withImports([row(3, "completed", 4)]);
  rerender({});

  expect(invalidatedKeys()).toContainEqual(["empresas", 7]);
});

it("hace polling cada 3s solo mientras haya imports en curso", () => {
  withImports([]);
  renderHook(() => useStatementImportsWatcher());
  const interval = options().refetchInterval;
  const q = (statuses: string[]) => ({
    state: { data: { data: statuses.map((s, i) => row(100 + i, s, 0)) } },
  });

  expect(interval(q(["completed", "pending"]))).toBe(3000);
  expect(interval(q(["processing"]))).toBe(3000);
  expect(interval(q(["completed", "failed", "partial"]))).toBe(false);
});

it("no consulta sin sesión real ni antes de que la pantalla cargue la lista", () => {
  withImports([]);
  const loaded = { state: { data: { data: [] } } };
  const { rerender } = renderHook(() => useStatementImportsWatcher());
  expect(options().enabled(loaded)).toBe(true);
  expect(options().enabled({ state: { data: undefined } })).toBe(false);

  mockAuth = { userId: 7, isAuthenticated: false, isGuest: false };
  rerender({});
  expect(options().enabled(loaded)).toBe(false);

  mockAuth = { userId: 7, isAuthenticated: true, isGuest: true };
  rerender({});
  expect(options().enabled(loaded)).toBe(false);
});
