import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as statementApi from "@/api/statement-imports.api";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";

const isInFlight = (status?: string) => status === "pending" || status === "processing";

// Último estado visto de cada import. Vive en el módulo para que la pantalla
// marque un import recién subido/reintentado sin estar montada junto al watcher.
const lastStatus = new Map<number, string>();

/**
 * Marca un import como en curso apenas el servidor lo acepta: si el backend
 * termina antes del siguiente poll, nunca lo veríamos en `pending` y no se
 * refrescarían transacciones ni empresas.
 */
export function markStatementImportInFlight(id: number): void {
  lastStatus.set(id, "pending");
}

// Pantalla y watcher comparten esta query (misma key): un solo poller.
const importsQuery = (userId: number | null) => ({
  queryKey: ["statement-imports", userId],
  queryFn: () => statementApi.getStatementImports(userId!),
});

/** Lista de imports del usuario; sin polling propio (lo hace el watcher). */
export function useStatementImports() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({ ...importsQuery(userId), enabled: !!userId });
}

/**
 * Montado en el layout raíz para que siga vivo al salir de la pantalla de
 * importación. Comparte la query de `useStatementImports` y es el único que
 * hace polling: cada 3s mientras haya algún import en `pending`/`processing`.
 * No consulta por su cuenta hasta que la pantalla haya cargado la lista (así
 * no agrega un GET en cada arranque), ni sin sesión real, ni sin conexión
 * (retoma al reconectar). Cuando un import en
 * curso termina creando registros, refresca transacciones y empresas
 * (`getEmpresas` también reescribe el caché SQLite de empresas).
 */
export function useStatementImportsWatcher(): void {
  const userId = useAuthStore((s) => s.userId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queryClient = useQueryClient();
  const canPoll = !!userId && isAuthenticated && !isGuest && isOnline;

  const { data } = useQuery({
    ...importsQuery(userId),
    enabled: (query) => canPoll && query.state.data !== undefined,
    refetchInterval: (query) =>
      query.state.data?.data.some((r) => isInFlight(r.status)) ? 3000 : false,
  });

  useEffect(() => {
    const rows = data?.data;
    if (!rows) return;
    const landed = rows.some(
      (r) =>
        isInFlight(lastStatus.get(r.id)) &&
        (r.status === "completed" || r.status === "partial") &&
        r.total_records_created > 0,
    );
    rows.forEach((r) => lastStatus.set(r.id, r.status));
    if (landed) {
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["companies", userId] });
      queryClient.invalidateQueries({ queryKey: ["empresas", userId] });
    }
  }, [data, queryClient, userId]);
}
