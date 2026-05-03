import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as catalogApi from "@/api/catalog.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  TransactionType,
} from "@/types/transaction.types";
import type { CategoryResponse } from "@/types/catalog.types";

const TRANSACTION_TYPES: TransactionType[] = ["INCOME", "EXPENSE", "TRANSFER"];

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
};

const TYPE_BG: Record<TransactionType, string> = {
  INCOME: "bg-emerald-100",
  EXPENSE: "bg-red-100",
  TRANSFER: "bg-blue-100",
};

const TYPE_TEXT: Record<TransactionType, string> = {
  INCOME: "text-emerald-700",
  EXPENSE: "text-red-600",
  TRANSFER: "text-blue-600",
};

const TYPE_AMOUNT: Record<TransactionType, string> = {
  INCOME: "text-brand-600",
  EXPENSE: "text-red-600",
  TRANSFER: "text-blue-600",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TransactionsScreen() {
  const userId = useAuthStore((s) => s.userId) ?? 1;
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createTransaction: createOffline } = useOfflineMutations();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<CreateTransactionRecordDto>>({
    type: "EXPENSE",
    currency: "COP",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading, refetch } = useOfflineQuery(
    {
      queryKey: ["transactions", userId],
      queryFn: () =>
        transactionsApi.getTransactions(userId, { limit: 50, page: 1 }),
      enabled: !!userId,
    },
    async () => {
      const rows = await localRepo.getLocalTransactions(userId);
      return { data: rows, total: rows.length };
    },
  );

  const { data: categories } = useOfflineQuery(
    {
      queryKey: ["categories"],
      queryFn: catalogApi.getCategories,
    },
    () => localRepo.getLocalCategories(),
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionRecordDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      setShowModal(false);
      setForm({
        type: "EXPENSE",
        currency: "COP",
        transactionDate: new Date().toISOString().split("T")[0],
      });
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Error al crear transacción",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsApi.deleteTransaction(userId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] }),
  });

  function handleCreate() {
    if (!form.amount || !form.categoryId || !form.type) {
      Alert.alert(
        "Campos requeridos",
        "Monto, categoría y tipo son obligatorios",
      );
      return;
    }
    createMutation.mutate(form as CreateTransactionRecordDto);
  }

  function confirmDelete(id: number) {
    if (!isOnline) {
      Alert.alert(
        "Sin conexión",
        "No puedes eliminar registros en modo offline",
      );
      return;
    }
    Alert.alert("Eliminar", "¿Seguro que deseas eliminar esta transacción?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  function renderItem({ item }: { item: TransactionRecordResponse }) {
    return (
      <View className="flex-row items-center bg-white rounded-xl p-3.5 mb-2 shadow-sm elevation-1 gap-x-2.5">
        <View className={`rounded-md px-2 py-1 ${TYPE_BG[item.type]}`}>
          <Text className={`text-xs font-bold ${TYPE_TEXT[item.type]}`}>
            {TYPE_LABELS[item.type]}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-brand-900">
            {item.description ?? `Transacción #${item.id}`}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {new Date(item.transactionDate).toLocaleDateString("es-CO")}
          </Text>
        </View>
        <View className="items-end gap-y-1">
          <Text className={`text-sm font-bold ${TYPE_AMOUNT[item.type]}`}>
            {item.type === "INCOME" ? "+" : "-"}
            {formatCurrency(Number(item.amount))}
          </Text>
          <TouchableOpacity onPress={() => confirmDelete(item.id)}>
            <Text className="text-red-600 text-sm font-bold">✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-50">
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-brand-100">
        <Text className="text-lg font-bold text-brand-900">Transacciones</Text>
        <TouchableOpacity
          className="bg-brand-900 rounded-lg px-3.5 py-2"
          onPress={() => setShowModal(true)}
        >
          <Text className="text-white font-semibold text-sm">+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" size="large" color="#1B4332" />
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={
            <Text className="text-gray-400 italic text-center mt-10">
              Sin transacciones registradas
            </Text>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-bold text-brand-900 mb-5">
              Nueva transacción
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Tipo
              </Text>
              <View className="flex-row gap-x-2 mb-4">
                {TRANSACTION_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    className={`rounded-lg px-3 py-2 border ${
                      form.type === t
                        ? "bg-brand-900 border-brand-900"
                        : "bg-brand-50 border-brand-100"
                    }`}
                    onPress={() => setForm((p) => ({ ...p, type: t }))}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        form.type === t ? "text-white" : "text-brand-900"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Monto
              </Text>
              <TextInput
                className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-sm"
                value={form.amount?.toString() ?? ""}
                onChangeText={(v) =>
                  setForm((p) => ({ ...p, amount: parseFloat(v) || undefined }))
                }
                placeholder="0"
                keyboardType="numeric"
              />

              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Categoría
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {(categories ?? []).map((cat: CategoryResponse) => (
                  <TouchableOpacity
                    key={cat.id}
                    className={`rounded-lg px-3 py-2 mr-2 border ${
                      form.categoryId === cat.id
                        ? "bg-brand-900 border-brand-900"
                        : "bg-brand-50 border-brand-100"
                    }`}
                    onPress={() =>
                      setForm((p) => ({ ...p, categoryId: cat.id }))
                    }
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        form.categoryId === cat.id
                          ? "text-white"
                          : "text-brand-900"
                      }`}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Descripción (opcional)
              </Text>
              <TextInput
                className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-sm"
                value={form.description ?? ""}
                onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                placeholder="Ej: Supermercado"
              />

              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Fecha (YYYY-MM-DD)
              </Text>
              <TextInput
                className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-sm"
                value={form.transactionDate ?? ""}
                onChangeText={(v) =>
                  setForm((p) => ({ ...p, transactionDate: v }))
                }
                placeholder="2026-04-26"
              />

              <View className="flex-row gap-x-3 mt-2 mb-4">
                <TouchableOpacity
                  className="flex-1 border border-brand-100 rounded-xl p-3.5 items-center"
                  onPress={() => setShowModal(false)}
                >
                  <Text className="text-brand-800 font-semibold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 bg-brand-900 rounded-xl p-3.5 items-center${
                    createMutation.isPending ? " opacity-60" : ""
                  }`}
                  onPress={handleCreate}
                  disabled={createMutation.isPending}
                >
                  <Text className="text-white font-bold">
                    {createMutation.isPending ? "Guardando…" : "Guardar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
