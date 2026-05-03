import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { useOfflineStore } from "@/store/offline.store";

/**
 * Hook que intenta la petición online primero y, si falla o no hay conexión,
 * cae al fallback local (SQLite).
 */
export function useOfflineQuery<TData>(
  options: UseQueryOptions<TData, Error, TData, QueryKey>,
  localFallback: () => Promise<TData>,
) {
  const isOnline = useOfflineStore((s) => s.isOnline);

  return useQuery<TData, Error>({
    ...options,
    queryFn: async () => {
      if (!isOnline) {
        return localFallback();
      }
      try {
        return await (options.queryFn as () => Promise<TData>)();
      } catch {
        return localFallback();
      }
    },
    // Cuando estamos offline, no reintentar con el servidor
    retry: isOnline ? (options.retry ?? 1) : false,
    networkMode: "always",
  });
}
