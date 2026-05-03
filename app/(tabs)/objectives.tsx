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
import * as objectivesApi from "@/api/objectives.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import type {
  FinancialObjectiveResponse,
  CreateFinancialObjectiveDto,
} from "@/types/objective.types";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <View className="h-2 bg-brand-100 rounded-full overflow-hidden mt-2">
      <View
        className="h-full bg-brand-900 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}

export default function ObjectivesScreen() {
  const userId = useAuthStore((s) => s.userId) ?? 1;
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createObjective: createOffline } = useOfflineMutations();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<CreateFinancialObjectiveDto>>({
    currency: "COP",
    targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });

  const {
    data: objectives,
    isLoading,
    refetch,
  } = useOfflineQuery(
    {
      queryKey: ["objectives", userId],
      queryFn: () => objectivesApi.getObjectives(userId),
      enabled: !!userId,
    },
    () => localRepo.getLocalObjectives(userId),
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateFinancialObjectiveDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setShowModal(false);
      setForm({
        currency: "COP",
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      });
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Error al crear objetivo",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      if (!isOnline) {
        return Promise.reject(new Error("Sin conexión"));
      }
      return objectivesApi.deleteObjective(userId, id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Error al eliminar",
      );
    },
  });

  function handleCreate() {
    if (!form.name || !form.targetAmount || !form.targetDate) {
      Alert.alert(
        "Campos requeridos",
        "Nombre, monto objetivo y fecha son obligatorios",
      );
      return;
    }
    createMutation.mutate(form as CreateFinancialObjectiveDto);
  }

  function confirmDelete(id: number, name: string) {
    Alert.alert("Eliminar objetivo", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  const completed = (objectives ?? []).filter((o) => o.isCompleted).length;
  const inProgress = (objectives ?? []).length - completed;

  function renderItem({ item }: { item: FinancialObjectiveResponse }) {
    const pct =
      item.targetAmount > 0
        ? Math.min(
            Math.round((item.currentAmount / item.targetAmount) * 100),
            100,
          )
        : 0;

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm elevation-2">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-base font-bold text-brand-900 flex-1">
            {item.name}
          </Text>
          <View className="flex-row items-center gap-x-2">
            {item.isCompleted && (
              <View className="bg-brand-100 rounded-md px-2 py-1">
                <Text className="text-xs font-semibold text-brand-600">
                  ✓ Completado
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={() => confirmDelete(item.id, item.name)}>
              <Text className="text-red-600 text-sm font-bold">✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.description ? (
          <Text className="text-sm text-brand-800 mb-1">
            {item.description}
          </Text>
        ) : null}

        <View className="flex-row items-baseline mt-2">
          <Text className="text-lg font-bold text-brand-900">
            {formatCurrency(Number(item.currentAmount))}
          </Text>
          <Text className="text-brand-800"> / </Text>
          <Text className="text-sm text-brand-800">
            {formatCurrency(Number(item.targetAmount))}
          </Text>
          <Text className="text-sm text-brand-600 font-semibold ml-1">
            ({pct}%)
          </Text>
        </View>

        <ProgressBar
          value={Number(item.currentAmount)}
          total={Number(item.targetAmount)}
        />

        <Text className="text-xs text-gray-400 mt-2">
          Fecha objetivo:{" "}
          {new Date(item.targetDate).toLocaleDateString("es-CO")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-50">
      {/* Summary */}
      <View className="bg-brand-900 flex-row justify-center px-5 pt-6 pb-5 gap-x-10">
        <View className="items-center">
          <Text className="text-white text-2xl font-bold">{inProgress}</Text>
          <Text className="text-brand-100 text-xs mt-0.5">En progreso</Text>
        </View>
        <View className="w-px bg-brand-700" />
        <View className="items-center">
          <Text className="text-white text-2xl font-bold">{completed}</Text>
          <Text className="text-brand-100 text-xs mt-0.5">Completados</Text>
        </View>
      </View>

      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-brand-100">
        <Text className="text-lg font-bold text-brand-900">
          Objetivos financieros
        </Text>
        <TouchableOpacity
          className="bg-brand-900 rounded-lg px-3.5 py-2"
          onPress={() => setShowModal(true)}
        >
          <Text className="text-white font-semibold text-sm">+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" size="large" color="#1B4332" />
      ) : (
        <FlatList
          data={objectives ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={
            <Text className="text-gray-400 italic text-center mt-10">
              Sin objetivos registrados
            </Text>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-bold text-brand-900 mb-5">
              Nuevo objetivo financiero
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  label: "Nombre",
                  key: "name",
                  placeholder: "Fondo de emergencia",
                },
                {
                  label: "Monto objetivo",
                  key: "targetAmount",
                  placeholder: "5000000",
                  numeric: true,
                },
                { label: "Moneda", key: "currency", placeholder: "COP" },
                {
                  label: "Fecha objetivo (YYYY-MM-DD)",
                  key: "targetDate",
                  placeholder: "2027-01-01",
                },
                {
                  label: "Descripción (opcional)",
                  key: "description",
                  placeholder: "Meta de ahorro...",
                },
              ].map(({ label, key, placeholder, numeric }) => (
                <View key={key}>
                  <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                    {label}
                  </Text>
                  <TextInput
                    className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-sm"
                    value={
                      key === "targetAmount"
                        ? (form.targetAmount?.toString() ?? "")
                        : ((form as Record<string, string | undefined>)[key] ??
                          "")
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
