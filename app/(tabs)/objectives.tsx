import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  Pressable,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as objectivesApi from "@/api/objectives.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import { Money } from "@/components/ui/Money";
import { Chip } from "@/components/ui/Chip";
import { StaleDataBanner } from "@/components/StaleDataBanner";
import { Target, Plus } from "@/components/ui/icons";
import { formatCurrency } from "@/utils/format";
import type {
  CreateFinancialObjectiveDto,
  FinancialObjectiveType,
} from "@/types/objective.types";

const OBJECTIVE_TYPES: FinancialObjectiveType[] = ["savings", "goal", "loan"];
const OBJECTIVE_TYPE_LABELS: Record<FinancialObjectiveType, string> = {
  savings: "Ahorro",
  goal: "Meta",
  loan: "Préstamo",
};

function ProgressBar({ value, total }: { value: number; total: number }) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const barColor = pct >= 75 ? c.success : pct >= 40 ? c.primary : c.warning;

  return (
    <View className="h-2 bg-muted rounded-full overflow-hidden mt-2">
      <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
    </View>
  );
}

function SummarySkeleton() {
  return (
    <View className="flex-row gap-4 px-4 pt-6 pb-4">
      <Skeleton width={140} height={60} borderRadius={12} />
      <Skeleton width={140} height={60} borderRadius={12} />
      <Skeleton width={140} height={60} borderRadius={12} />
    </View>
  );
}

function ListSkeleton() {
  return (
    <View className="p-4 gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <Skeleton width={160} height={16} className="mb-2" />
          <Skeleton width={120} height={12} className="mb-3" />
          <Skeleton width="100%" height={10} borderRadius={5} />
        </Card>
      ))}
    </View>
  );
}

export default function ObjectivesScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createObjective: createOffline, deleteObjective: deleteOffline } =
    useOfflineMutations();
  const { resolvedScheme } = useAppTheme();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateFinancialObjectiveDto>(() => ({
    name: "",
    type: "savings",
    target_amount: 0,
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  }));

  const {
    data: objectives,
    isLoading,
    refetch,
    isUsingFallback,
  } = useOfflineQuery(
    {
      queryKey: ["objectives", userId],
      queryFn: () => objectivesApi.getObjectives(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalObjectives(userId as number),
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateFinancialObjectiveDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setShowModal(false);
      setForm({
        name: "",
        type: "savings",
        target_amount: 0,
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      });
    },
    onError: (err: unknown) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Error al crear objetivo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      if (!isOnline) return Promise.reject(new Error("Sin conexión"));
      return deleteOffline(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
    onError: (err: unknown) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Error al eliminar");
    },
  });

  function handleCreate() {
    if (!form.name.trim() || !form.target_amount || !form.end_date) {
      Alert.alert("Campos requeridos", "Nombre, monto y fecha son obligatorios");
      return;
    }
    createMutation.mutate(form);
  }

  function confirmDelete(id: number, name: string) {
    Alert.alert("Eliminar objetivo", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  const completed = (objectives ?? []).filter((o) => o.is_completed).length;
  const inProgress = (objectives ?? []).length - completed;
  const totalTarget = (objectives ?? []).reduce(
    (s, o) => s + Number(o.target_amount ?? 0),
    0,
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <SummarySkeleton />
        <ListSkeleton />
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <EmptyState
          icon={Target}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para ver tus datos."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {isUsingFallback && <StaleDataBanner onRetry={refetch} />}
      <FlatList
        data={objectives ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Summary Cards */}
            <View className="flex-row px-4 gap-3 mt-4">
              <Card className="flex-1 items-center py-4">
                <Text className="text-2xl font-num-semibold text-foreground">{inProgress}</Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">En progreso</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <Text className="text-2xl font-num-semibold text-success">{completed}</Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">Completados</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <Text className="text-lg font-num-semibold text-foreground">
                  {formatCurrency(totalTarget)}
                </Text>
                <Text className="text-xs font-sans text-muted-foreground mt-1">Total meta</Text>
              </Card>
            </View>

            <View className="flex-row justify-between items-center px-4 mt-6 mb-3">
              <Text className="text-lg font-display text-foreground">Objetivos financieros</Text>
              <Button size="sm" onPress={() => setShowModal(true)}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nuevo</Text>
              </Button>
            </View>
          </>
        }
        renderItem={({ item, index }) => {
          const target = item.target_amount ?? 0;
          const pct =
            target > 0 ? Math.min(Math.round((item.current_balance / target) * 100), 100) : 0;

          return (
            <AnimatedListItem index={index} className="mx-4 mb-3">
              <Pressable
                onPress={() => router.push(`/objectives/${item.id}` as never)}
                onLongPress={() => confirmDelete(item.id, item.name)}
              >
                <Card>
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className="text-base font-display text-foreground flex-1">{item.name}</Text>
                    {item.is_completed && <Badge tone="success">Completado</Badge>}
                  </View>

                  <Text className="text-sm font-sans text-muted-foreground mb-2">
                    {OBJECTIVE_TYPE_LABELS[item.type]}
                  </Text>

                  <View className="flex-row items-baseline mt-1">
                    <Money value={Number(item.current_balance)} className="text-lg text-foreground" />
                    <Text className="text-muted-foreground font-sans"> / </Text>
                    <Text className="text-sm font-sans text-muted-foreground">
                      {formatCurrency(target)}
                    </Text>
                    <Text className="text-sm font-num-semibold text-success ml-1">({pct}%)</Text>
                  </View>

                  <ProgressBar value={Number(item.current_balance)} total={target} />

                  {item.end_date && (
                    <View className="flex-row justify-between items-center mt-3">
                      <Text className="text-xs font-sans text-muted-foreground">
                        Meta: {new Date(item.end_date).toLocaleDateString("es-CO")}
                      </Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            </AnimatedListItem>
          );
        }}
        ListEmptyComponent={
          <View className="px-4">
            <Card>
              <EmptyState
                icon={Target}
                title="Sin objetivos"
                description="Crea tu primer objetivo financiero para empezar a ahorrar"
                action={
                  <Button variant="outline" size="sm" onPress={() => setShowModal(true)}>
                    Crear objetivo
                  </Button>
                }
              />
            </Card>
          </View>
        }
      />

      {/* Create Objective Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">
              Nuevo objetivo financiero
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Nombre"
                value={form.name}
                onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                placeholder="Fondo de emergencia"
              />

              <Text className="text-sm font-sans-medium text-foreground mb-2">Tipo</Text>
              <View className="flex-row gap-2 mb-4">
                {OBJECTIVE_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={OBJECTIVE_TYPE_LABELS[t]}
                    selected={form.type === t}
                    fullWidth
                    onPress={() => setForm((p) => ({ ...p, type: t }))}
                  />
                ))}
              </View>

              <CurrencyInput
                label="Monto objetivo"
                value={form.target_amount ? String(form.target_amount) : ""}
                onChangeValue={(raw) =>
                  setForm((p) => ({ ...p, target_amount: raw ? parseFloat(raw) : 0 }))
                }
                placeholder="5000000"
              />
              <Input
                label="Fecha objetivo (YYYY-MM-DD)"
                value={form.end_date ?? ""}
                onChangeText={(v) => setForm((p) => ({ ...p, end_date: v }))}
                placeholder="2027-01-01"
              />

              <View className="flex-row gap-3 mt-2 mb-4">
                <Button variant="outline" className="flex-1" onPress={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" loading={createMutation.isPending} onPress={handleCreate}>
                  Guardar
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
