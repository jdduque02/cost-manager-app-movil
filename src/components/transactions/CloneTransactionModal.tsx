import { View, Text, Modal, ScrollView } from "react-native";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import type { TransactionRecordResponse } from "@/types/transaction.types";

interface CloneTransactionModalProps {
  visible: boolean;
  transaction: TransactionRecordResponse | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (overrides: {
    transaction_date?: string;
    amount?: number;
    description?: string;
  }) => void;
}

/**
 * Mini-formulario para ajustar fecha/monto/descripción antes de duplicar una
 * transacción — equivalente móvil del mini-modal de clonado de la web
 * (TransactionDialog.tsx), simplificado a los 3 campos que más se editan al
 * duplicar en vez de repetir el formulario completo.
 */
export function CloneTransactionModal({
  visible,
  transaction,
  isPending,
  onClose,
  onConfirm,
}: CloneTransactionModalProps) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  // Precarga los campos cuando cambia la transacción a duplicar. Se actualiza
  // durante el render (en vez de en un efecto) para evitar un segundo render
  // en cascada — mismo patrón que `lastValue` en CurrencyInput.tsx.
  const [lastTransactionId, setLastTransactionId] = useState<number | null>(null);
  if (transaction && transaction.id !== lastTransactionId) {
    setLastTransactionId(transaction.id);
    setDate(transaction.transaction_date.split("T")[0]);
    setAmount(String(transaction.amount));
    setDescription(transaction.description ?? "");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
          <Text className="text-lg font-display text-foreground mb-1">
            Duplicar transacción
          </Text>
          <Text className="text-sm font-sans text-muted-foreground mb-5">
            Ajusta lo que cambie y crea una copia.
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <CurrencyInput
              label="Monto"
              value={amount}
              onChangeValue={setAmount}
              placeholder="0"
            />
            <Input
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Supermercado"
            />
            <Input
              label="Fecha (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-04-26"
            />
            <View className="flex-row gap-3 mt-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={isPending}
                onPress={() =>
                  onConfirm({
                    transaction_date: date || undefined,
                    amount: amount ? parseFloat(amount) : undefined,
                    description: description || undefined,
                  })
                }
              >
                Duplicar
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
