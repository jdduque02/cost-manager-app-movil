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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import type {
  BankAccountResponse,
  CreateBankAccountDto,
} from "@/types/banking.types";

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CREDIT", "INVESTMENT"];
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Corriente",
  SAVINGS: "Ahorros",
  CREDIT: "Crédito",
  INVESTMENT: "Inversión",
};

function formatCurrency(amount: number, currency = "COP"): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BankingScreen() {
  const userId = useAuthStore((s) => s.userId) ?? 1;
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createBankAccount: createOffline } = useOfflineMutations();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<CreateBankAccountDto>>({
    accountType: "SAVINGS",
    currency: "COP",
    balance: 0,
  });

  const {
    data: accounts,
    isLoading,
    refetch,
  } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId),
      enabled: !!userId,
    },
    () => localRepo.getLocalBankAccounts(userId),
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateBankAccountDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
      setShowModal(false);
      setForm({ accountType: "SAVINGS", currency: "COP", balance: 0 });
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Error al crear cuenta",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bankingApi.deleteBankAccount(userId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] }),
  });

  function handleCreate() {
    if (!form.name || !form.bankName || !form.accountType) {
      Alert.alert("Campos requeridos", "Nombre, banco y tipo son obligatorios");
      return;
    }
    createMutation.mutate(form as CreateBankAccountDto);
  }

  function confirmDelete(id: number, name: string) {
    if (!isOnline) {
      Alert.alert(
        "Sin conexión",
        "No puedes eliminar registros en modo offline",
      );
      return;
    }
    Alert.alert("Eliminar cuenta", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  const totalBalance = (accounts ?? []).reduce(
    (s, a) => s + Number(a.balance),
    0,
  );

  function renderItem({ item }: { item: BankAccountResponse }) {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm elevation-2">
        <View className="flex-row justify-between items-start mb-2.5">
          <View>
            <Text className="text-base font-bold text-brand-900">
              {item.name}
            </Text>
            <Text className="text-xs text-brand-800 mt-0.5">
              {item.bankName}
            </Text>
          </View>
          <View className="items-end gap-y-1.5">
            <View className="bg-brand-100 rounded-md px-2 py-1">
              <Text className="text-xs font-semibold text-brand-900">
                {ACCOUNT_TYPE_LABELS[item.accountType] ?? item.accountType}
              </Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item.id, item.name)}>
              <Text className="text-red-600 text-sm font-bold">✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-2xl font-bold text-brand-900">
          {formatCurrency(Number(item.balance), item.currency)}
        </Text>
        <View
          className={`self-start mt-2 rounded-md px-2 py-1 ${
            item.isActive ? "bg-emerald-600" : "bg-gray-400"
          }`}
        >
          <Text className="text-white text-xs font-semibold">
            {item.isActive ? "Activa" : "Inactiva"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-50">
      {/* Summary */}
      <View className="bg-brand-900 px-5 pt-6 pb-5">
        <Text className="text-brand-100 text-sm">Balance total</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatCurrency(totalBalance)}
        </Text>
      </View>

      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-brand-100">
        <Text className="text-lg font-bold text-brand-900">
          Cuentas bancarias
        </Text>
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
          data={accounts ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={
            <Text className="text-gray-400 italic text-center mt-10">
              Sin cuentas registradas
            </Text>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-bold text-brand-900 mb-5">
              Nueva cuenta bancaria
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  label: "Nombre de la cuenta",
                  key: "name",
                  placeholder: "Mi cuenta de ahorros",
                },
                { label: "Banco", key: "bankName", placeholder: "Bancolombia" },
                {
                  label: "Saldo inicial",
                  key: "balance",
                  placeholder: "0",
                  numeric: true,
                },
                { label: "Moneda", key: "currency", placeholder: "COP" },
              ].map(({ label, key, placeholder, numeric }) => (
                <View key={key}>
                  <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                    {label}
                  </Text>
                  <TextInput
                    className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-sm"
                    value={
                      key === "balance"
                        ? (form.balance?.toString() ?? "")
                        : ((form as Record<string, string>)[key] ?? "")
                    }
                    onChangeText={(v) =>
                      setForm((p) => ({
                        ...p,
                        [key]: numeric ? parseFloat(v) || 0 : v,
                      }))
                    }
                    placeholder={placeholder}
                    keyboardType={numeric ? "numeric" : "default"}
                  />
                </View>
              ))}

              <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                Tipo de cuenta
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    className={`rounded-lg px-3 py-2 border ${
                      form.accountType === t
                        ? "bg-brand-900 border-brand-900"
                        : "bg-brand-50 border-brand-100"
                    }`}
                    onPress={() => setForm((p) => ({ ...p, accountType: t }))}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        form.accountType === t ? "text-white" : "text-brand-900"
                      }`}
                    >
                      {ACCOUNT_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
