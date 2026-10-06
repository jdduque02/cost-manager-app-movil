import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { processRecurring } from "@/api/recurring.api";

/** Día local `YYYY-MM-DD`: la guarda se renueva a medianoche del dispositivo. */
function localDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Dispara `process` de recurrentes (R2.3) tras el login y al volver a primer
 * plano, siempre con conexión y sin ser invitado. No navega, solo dispara.
 * Guarda: una vez por usuario y día local por arranque de la app (el API ya
 * limita a una vez al día; un `{0,0,0}` no significa "nada pendiente"). Un
 * fallo no bloquea la app y libera la guarda para reintentar en el siguiente
 * disparo.
 */
export function useRecurringProcess() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || isGuest || !isAuthenticated || !isOnline) return;

    const run = () => {
      const key = `${userId}:${localDay()}`;
      if (ranFor.current === key) return;
      ranFor.current = key;
      processRecurring(userId)
        .then((result) => {
          if (result.created > 0 || result.adopted > 0) {
            for (const k of ["transactions", "bank-accounts", "financial-liabilities", "notifications", "recurring"]) {
              queryClient.invalidateQueries({ queryKey: [k, userId] });
            }
          }
        })
        .catch(() => {
          if (ranFor.current === key) ranFor.current = null;
        });
    };

    run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => sub.remove();
  }, [userId, isGuest, isAuthenticated, isOnline, queryClient]);
}
