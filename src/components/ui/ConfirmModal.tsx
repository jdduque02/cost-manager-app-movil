import { View, Text, Modal } from "react-native";
import { Button, type ButtonVariant } from "@/components/ui/Button";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" mapea el botón de confirmar a `variant="destructive"` de Button. */
  tone?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Alias de `onCancel`, para calzar con el `onRequestClose` nativo del Modal. */
  onRequestClose?: () => void;
}

/**
 * Modal de confirmación del design system — reemplaza los usos de
 * `Alert.alert` para confirmaciones (destructivas o no). Reusa el mismo
 * lenguaje visual que los modales ad-hoc existentes (overlay + hoja
 * bg-card rounded-t-3xl).
 */
export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
  onRequestClose,
}: ConfirmModalProps) {
  const confirmVariant: ButtonVariant = tone === "destructive" ? "destructive" : "default";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose ?? onCancel}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-card rounded-t-3xl p-6">
          <Text className="text-lg font-display text-foreground mb-2">{title}</Text>
          {description && (
            <Text className="text-sm font-sans text-muted-foreground mb-5">{description}</Text>
          )}
          <View className="flex-row gap-3 mt-4">
            <Button variant="outline" className="flex-1" onPress={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              className="flex-1"
              loading={loading}
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
