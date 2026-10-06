import { View, Text, Modal, ScrollView } from "react-native";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type { ValidateRecurringTransactionDto } from "@/types/recurring.types";

export const VALIDATE_OFFLINE_MESSAGE = "Necesitas conexión para validar un pago";

/** Fecha local `YYYY-MM-DD` (no UTC: de noche en Bogotá `toISOString` ya es mañana). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valida y arma el payload (R3.6, R3.7); el API repite la regla de fecha. */
function buildDto(date: string, amount: string): string | ValidateRecurringTransactionDto {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return "Escribe la fecha real del pago (YYYY-MM-DD)";
  }
  if (date > today()) return "La fecha del pago no puede ser futura";
  const value = parseFloat(amount);
  if (!value || value <= 0) return "El monto debe ser mayor a 0";
  return { transaction_date: date, amount: value };
}

interface ValidatePaymentModalProps {
  visible: boolean;
  transaction: TransactionRecordResponse | null;
  isOnline: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (dto: ValidateRecurringTransactionDto) => void;
}

/**
 * Valida el pago de una transacción "por validar" de un recurrente `confirm`
 * (R3.6). Va directo al API: sin conexión el botón queda deshabilitado (R8.5).
 */
export function ValidatePaymentModal({
  visible,
  transaction,
  isOnline,
  isPending,
  onClose,
  onConfirm,
}: ValidatePaymentModalProps) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Mismo patrón que CloneTransactionModal: precarga al cambiar la transacción.
  const [lastId, setLastId] = useState<number | null>(null);
  if (!transaction && lastId !== null) setLastId(null);
  if (transaction && transaction.id !== lastId) {
    setLastId(transaction.id);
    setDate(today());
    setAmount(String(transaction.amount));
    setError(null);
  }

  function submit() {
    const dto = buildDto(date.trim(), amount);
    if (typeof dto === "string") {
      setError(dto);
      return;
    }
    setError(null);
    onConfirm(dto);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
          <Text className="text-lg font-display text-foreground mb-1">Validar pago</Text>
          <Text className="text-sm font-sans text-muted-foreground mb-5">
            {transaction?.description ?? "Confirma la fecha real y el monto pagado."}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <CurrencyInput label="Monto" value={amount} onChangeValue={setAmount} placeholder="0" />
            <Input
              label="Fecha del pago (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-10-05"
            />
            {error && <Text className="text-xs font-sans text-destructive mb-2">{error}</Text>}
            {!isOnline && (
              <Text className="text-xs font-sans text-muted-foreground mb-2">
                {VALIDATE_OFFLINE_MESSAGE}
              </Text>
            )}
            <View className="flex-row gap-3 mt-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                Cancelar
              </Button>
              <Button className="flex-1" loading={isPending} disabled={!isOnline} onPress={submit}>
                Validar
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
