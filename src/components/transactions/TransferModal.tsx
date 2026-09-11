import { View, Text, Modal, ScrollView, Alert } from "react-native";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Chip } from "@/components/ui/Chip";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import * as transfersApi from "@/api/transfers.api";
import type { BankAccountResponse, FinancialLiabilityResponse } from "@/types/banking.types";
import type { CreateTransferDto } from "@/types/transfer.types";

type DestinationKind = "account" | "liability";

const DESTINATION_OPTIONS: SegmentedOption<DestinationKind>[] = [
  { value: "account", label: "Cuenta" },
  { value: "liability", label: "Pasivo (pago de deuda)" },
];

interface TransferModalProps {
  visible: boolean;
  userId: number;
  isOnline: boolean;
  bankAccounts: BankAccountResponse[];
  liabilities: FinancialLiabilityResponse[];
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Las transferencias son un modelo separado del de transacciones (endpoint
 * y payload propios: `source_account_id` + `destination_account_id` o
 * `destination_liability_id`) — ver TransferDialog.tsx en la web. No tienen
 * soporte offline: requieren conexión, igual que el borrado de transacciones.
 */
export function TransferModal({
  visible,
  userId,
  isOnline,
  bankAccounts,
  liabilities,
  onClose,
  onCreated,
}: TransferModalProps) {
  const [sourceAccountId, setSourceAccountId] = useState<number | undefined>();
  const [destinationKind, setDestinationKind] = useState<DestinationKind>("account");
  const [destinationAccountId, setDestinationAccountId] = useState<number | undefined>();
  const [destinationLiabilityId, setDestinationLiabilityId] = useState<number | undefined>();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const destinationAccounts = bankAccounts.filter((a) => a.id !== sourceAccountId);

  /**
   * Cambiar la cuenta de origen a la que ya estaba elegida como destino debe
   * limpiar el destino: `destinationAccounts` la oculta de la lista (no
   * puede transferirse una cuenta a sí misma), pero sin este guard
   * `destinationAccountId` quedaba en un valor ya no visible ni válido.
   */
  function handleSelectSource(id: number) {
    setSourceAccountId(id);
    if (destinationAccountId === id) {
      setDestinationAccountId(undefined);
    }
  }

  function reset() {
    setSourceAccountId(undefined);
    setDestinationKind("account");
    setDestinationAccountId(undefined);
    setDestinationLiabilityId(undefined);
    setAmount("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
  }

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransferDto) => transfersApi.createTransfer(userId, dto),
    onSuccess: () => {
      reset();
      onCreated();
      onClose();
    },
    onError: (err: unknown) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Error al crear la transferencia");
    },
  });

  function handleSubmit() {
    if (!isOnline) {
      Alert.alert("Sin conexión", "Las transferencias requieren conexión a internet");
      return;
    }
    const parsedAmount = amount ? parseFloat(amount) : 0;
    if (!sourceAccountId || !parsedAmount || parsedAmount <= 0) {
      Alert.alert("Campos requeridos", "Cuenta de origen y monto son obligatorios");
      return;
    }
    if (destinationKind === "account" && !destinationAccountId) {
      Alert.alert("Campo requerido", "Selecciona la cuenta destino");
      return;
    }
    if (destinationKind === "liability" && !destinationLiabilityId) {
      Alert.alert("Campo requerido", "Selecciona el pasivo destino");
      return;
    }

    createMutation.mutate({
      source_account_id: sourceAccountId,
      ...(destinationKind === "account"
        ? { destination_account_id: destinationAccountId }
        : { destination_liability_id: destinationLiabilityId }),
      amount: parsedAmount,
      transaction_date: date || undefined,
      description: description || undefined,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
          <Text className="text-lg font-display text-foreground mb-5">Nueva transferencia</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-sm font-sans-medium text-foreground mb-1.5">
              Cuenta de origen
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {bankAccounts.length === 0 ? (
                <Text className="text-sm font-sans text-muted-foreground py-2">
                  No tienes cuentas bancarias registradas
                </Text>
              ) : (
                bankAccounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={`${a.bank_name} ${a.masked_account_number}`}
                    selected={sourceAccountId === a.id}
                    onPress={() => handleSelectSource(a.id)}
                    className="mr-2"
                  />
                ))
              )}
            </ScrollView>

            <Text className="text-sm font-sans-medium text-foreground mb-1.5">Destino</Text>
            <View className="mb-3">
              <SegmentedControl
                options={DESTINATION_OPTIONS}
                value={destinationKind}
                onChange={setDestinationKind}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {destinationKind === "account"
                ? destinationAccounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={`${a.bank_name} ${a.masked_account_number}`}
                      selected={destinationAccountId === a.id}
                      onPress={() => setDestinationAccountId(a.id)}
                      className="mr-2"
                    />
                  ))
                : liabilities.map((l) => (
                    <Chip
                      key={l.id}
                      label={l.name}
                      selected={destinationLiabilityId === l.id}
                      onPress={() => setDestinationLiabilityId(l.id)}
                      className="mr-2"
                    />
                  ))}
            </ScrollView>

            <CurrencyInput
              label="Monto"
              value={amount}
              onChangeValue={setAmount}
              placeholder="0"
              testID="transfer-amount-input"
            />
            <Input
              label="Descripción (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Pago tarjeta"
            />
            <Input
              label="Fecha (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-04-26"
            />

            <View className="flex-row gap-3 mt-2 mb-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" loading={createMutation.isPending} onPress={handleSubmit}>
                Transferir
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
