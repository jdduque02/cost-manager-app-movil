import { QueryClient } from "@tanstack/react-query";

/**
 * Instancia única de QueryClient de la app. Vive en su propio módulo para que
 * `src/store/offline.store.ts` (sincronización, fuera de React) pueda invalidar
 * queries tras un sync sin depender de `useQueryClient` ni de React context.
 * `app/_layout.tsx` lo provee vía `QueryClientProvider`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});