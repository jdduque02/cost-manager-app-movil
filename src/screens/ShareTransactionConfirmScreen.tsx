import { View, Text, ScrollView, Alert } from "react-native";
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as catalogApi from "@/api/catalog.api";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import type { CategoryResponse } from "@/types/catalog.types";
import type { CreateTransactionRecordDto } from "@/types/transaction.types";
import { parseBankMessage } from "@/utils/bank-message-parser";
import {
  TRANSACTION_TYPES,
  TYPE_LABELS,
} from "@/utils/transaction-labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArrowLeft, MessageSquareText } from "@/components/ui/icons";

const BANK_LABELS: Record<string, string> = {
  bancolombia: "Bancolombia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  davivienda: "Davivienda",
  banco_de_bogota: "Banco de Bogotá",
  bbva: "BBVA",
  unknown: "Banco no identificado",
};

interface ShareTransactionConfirmScreenProps {
  /** Texto compartido crudo (mensaje del banco) recibido vía share intent. */
  sharedText: string;
}

/**
 * Pantalla de confirmación mostrada al recibir un mensaje bancario
 * compartido manualmente desde la app de SMS/notificaciones del sistema
 * (ver memory/share-transaction-decision.md). Prellena el formulario con lo
 * que `parseBankMessage` pudo inferir y deja todo editable — nunca guarda
 * automáticamente.
 */
export default function ShareTransactionConfirmScreen({
  sharedText,
}: ShareTransactionConfirmScreenProps) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { createTransaction: createOffline } = useOfflineMutations();

  const parsed = useMemo(() => parseBankMessage(sharedText), [sharedText]);

  const [categorySearch, setCategorySearch] = useState("");
  const [form, setForm] = useState<Partial<CreateTransactionRecordDto>>({
    type: parsed.type ?? "expense",
    currency: "COP",
    amount: parsed.amount ?? undefined,
    description: parsed.counterparty ?? undefined,
    transaction_date: parsed.date ?? new Date().toISOString().split("T")[0],
  });

  const { data: categories } = useOfflineQuery(
    {
      queryKey: ["categories"],
      queryFn: catalogApi.getCategories,
    },
    () => localRepo.getLocalCategories(),
  );

  const { data: bankAccounts } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => (userId ? bankingApi.getBankAccounts(userId) : Promise.resolve([])),
      enabled: !!userId,
    },
    () => (userId ? localRepo.getLocalBankAccounts(userId) : Promise.resolve([])),
  );

  // Cuenta bancaria inferida por coincidencia de nombre de banco — solo si
  // hay una única cuenta que matchea, para no adivinar entre varias del
  // mismo banco (ej. dos cuentas Bancolombia).
  const inferredAccountId = useMemo(() => {
    if (parsed.bank === "unknown" || !bankAccounts?.length) return undefined;
    const bankLabel = BANK_LABELS[parsed.bank].toLowerCase();
    const matches = bankAccounts.filter((acc) =>
      acc.bank_name.toLowerCase().includes(bankLabel),
    );
    return matches.length === 1 ? matches[0].id : undefined;
  }, [parsed.bank, bankAccounts]);

  const filteredCategories = useMemo(() => {
    const list = categories ?? [];
    if (!categorySearch.trim()) return list;
    const q = categorySearch.toLowerCase();
    return list.filter((cat: CategoryResponse) => cat.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionRecordDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      router.back();
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Error al registrar la transacción",
      );
    },
  });

  function handleSave() {
    if (!form.amount || !form.category_id || !form.type) {
      Alert.alert(
        "Campos requeridos",
        "Monto, categoría y tipo son obligatorios",
      );
      return;
    }
    const dto: CreateTransactionRecordDto = {
      ...form,
      account_id: form.account_id ?? inferredAccountId,
    } as CreateTransactionRecordDto;
    createMutation.mutate(dto);
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <EmptyState
          icon={MessageSquareText}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para registrar esta transacción."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        <PageHeader
          title="Confirmar transacción"
          subtitle="Revisa y ajusta los datos detectados antes de guardar"
          actions={
            <Button variant="ghost" size="icon" onPress={() => router.back()}>
              <ArrowLeft size={18} />
            </Button>
          }
        />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Card variant="flat" className="p-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-sans-medium text-foreground">
              Mensaje detectado
            </Text>
            <Badge tone={parsed.bank === "unknown" ? "muted" : "primary"}>
              {BANK_LABELS[parsed.bank]}
            </Badge>
          </View>
          <Text className="text-xs font-sans text-muted-foreground" numberOfLines={4}>
            {sharedText}
          </Text>
        </Card>

        {parsed.bank === "unknown" && (
          <Text className="text-xs font-sans text-muted-foreground mb-4">
            No reconocimos el formato de este mensaje — completa los campos
            manualmente.
          </Text>
        )}

        <Text className="text-sm font-sans-medium text-foreground mb-1.5">Tipo</Text>
        <View className="flex-row gap-2 mb-4 flex-wrap">
          {TRANSACTION_TYPES.map((t) => (
            <Chip
              key={t}
              label={TYPE_LABELS[t]}
              selected={form.type === t}
              onPress={() => setForm((p) => ({ ...p, type: t }))}
            />
          ))}
        </View>

        <CurrencyInput
          label="Monto"
          value={form.amount != null ? String(form.amount) : ""}
          onChangeValue={(raw) =>
            setForm((p) => ({ ...p, amount: raw ? parseFloat(raw) : undefined }))
          }
          placeholder="0"
        />

        <Text className="text-sm font-sans-medium text-foreground mb-1.5">Categoría</Text>
        <Input
          value={categorySearch}
          onChangeText={setCategorySearch}
          placeholder="Buscar categoría..."
          className="mb-2"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {filteredCategories.length === 0 ? (
            <Text className="text-sm font-sans text-muted-foreground py-2">
              Sin resultados
            </Text>
          ) : (
            filteredCategories.map((cat: CategoryResponse) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={form.category_id === cat.id}
                onPress={() => setForm((p) => ({ ...p, category_id: cat.id }))}
                className="mr-2"
              />
            ))
          )}
        </ScrollView>

        <Input
          label="Comercio / beneficiario"
          value={form.description ?? ""}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          placeholder="Ej: Supermercado"
        />

        <Input
          label="Fecha (YYYY-MM-DD)"
          value={form.transaction_date ?? ""}
          onChangeText={(v) => setForm((p) => ({ ...p, transaction_date: v }))}
          placeholder="2026-04-26"
        />

        {inferredAccountId && (
          <Text className="text-xs font-sans text-muted-foreground mb-4">
            Se asociará automáticamente a tu cuenta de{" "}
            {BANK_LABELS[parsed.bank]}.
          </Text>
        )}

        <View className="flex-row gap-3 mt-2">
          <Button variant="outline" className="flex-1" onPress={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" loading={createMutation.isPending} onPress={handleSave}>
            Guardar
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
