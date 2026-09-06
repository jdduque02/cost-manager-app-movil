import { useState } from "react";
import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { useOfflineStore } from "@/store/offline.store";
import { isSessionExpiredError } from "@/api/client";

/**
 * Hook que intenta la petición online primero y, si falla o no hay conexión,
 * cae al fallback local (SQLite).
 *
 * Una sesión expirada (401 irrecuperable) NO cae al fallback silenciosamente
 * — se deja propagar como error de la query, porque esconderla como "sin
 * datos" fue exactamente el bug reportado (dashboard en $0 en vez de avisar
 * que la sesión expiró). El redirect a login lo maneja `app/_layout.tsx` de
 * forma global al reaccionar a `isAuthenticated`. Cualquier otro fallo (red,
 * 500, etc.) sigue devolviendo el fallback como antes, pero ahora expone
 * `isUsingFallback`/`fallbackError` para que la pantalla pueda avisar que
 * está mostrando datos guardados.
 */
export function useOfflineQuery<TData>(
  options: UseQueryOptions<TData, Error, TData, QueryKey>,
  localFallback: () => Promise<TData>,
) {
  const isOnline = useOfflineStore((s) => s.isOnline);
  // El resultado de una query que cayó al fallback sigue siendo un `success`
  // desde la perspectiva de React Query (no lanza), así que `query.isError`
  // no sirve para detectarlo — este estado se actualiza dentro de `queryFn`
  // (fuera de render) cada vez que se resuelve la petición.
  const [fallbackError, setFallbackError] = useState<Error | null>(null);

  const query = useQuery<TData, Error>({
    ...options,
    queryFn: async () => {
      if (!isOnline) {
        setFallbackError(null);
        return localFallback();
      }
      try {
        const result = await (options.queryFn as () => Promise<TData>)();
        setFallbackError(null);
        return result;
      } catch (err) {
        if (isSessionExpiredError(err)) throw err;
        setFallbackError(err instanceof Error ? err : new Error(String(err)));
        return localFallback();
      }
    },
    // Cuando estamos offline, no reintentar con el servidor
    retry: isOnline ? (options.retry ?? 1) : false,
    networkMode: "always",
  });

  const isUsingFallback = isOnline && !query.isLoading && fallbackError !== null;

  return {
    ...query,
    isUsingFallback,
    fallbackError: isUsingFallback ? fallbackError : null,
  };
}
