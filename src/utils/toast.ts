import RNToast from "react-native-toast-message";

/**
 * API simple sobre `react-native-toast-message` para notificaciones no
 * bloqueantes (éxito, error, info, advertencia). No reemplaza `Alert.alert`
 * para confirmaciones (acciones destructivas o que requieren una decisión
 * explícita del usuario) — esas deben seguir usando `Alert.alert` o un modal.
 *
 * Uso:
 *   import { toast } from "@/utils/toast";
 *   toast.success("Categoría creada");
 *   toast.error("No se pudo guardar", "Verifica tu conexión");
 */
export const toast = {
  success(text1: string, text2?: string) {
    RNToast.show({ type: "success", text1, text2 });
  },
  error(text1: string, text2?: string) {
    RNToast.show({ type: "error", text1, text2 });
  },
  info(text1: string, text2?: string) {
    RNToast.show({ type: "info", text1, text2 });
  },
  warning(text1: string, text2?: string) {
    RNToast.show({ type: "warning", text1, text2 });
  },
  hide() {
    RNToast.hide();
  },
};

/** Alias directo para quien prefiera un solo helper con `type` explícito. */
export function showToast(
  type: "success" | "error" | "info" | "warning",
  text1: string,
  text2?: string,
) {
  toast[type](text1, text2);
}
