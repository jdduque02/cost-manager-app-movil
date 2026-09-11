import { View, Text, ScrollView, RefreshControl, Modal, Pressable } from "react-native";
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import * as objectivesApi from "@/api/objectives.api";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
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
import { ArrowLeft, Search, PiggyBank } from "@/components/ui/icons";
import { toast } from "@/utils/toast";
import type {
  FinancialObjectiveResponse,
  ObjectivePaymentResponse,
} from "@/types/objective.types";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const color = pct >= 75 ? "bg-success" : pct >= 40 ? "bg-primary" : "bg-warning";

  return (
    <View className="h-3 bg-muted rounded-full overflow-hidden">
      <View className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </View>
  );
}

function DetailSkeleton() {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 gap-4">
        <Skeleton width="100%" height={160} borderRadius={16} />
        <Skeleton width="100%" height={120} borderRadius={12} />
        <Skeleton width="100%" height={100} borderRadius={12} />
        <Skeleton width="100%" height={200} borderRadius={12} />
      </View>
    </ScrollView>
  );
}

export default function ObjectiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const objectiveId = Number(id);
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { resolvedScheme } = useAppTheme();

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const {
    data: objective,
    isLoading: loadingObjective,
    refetch: refetchObjective,
  } = useOfflineQuery(
    {
      queryKey: ["objective", userId, objectiveId],
      queryFn: () => objectivesApi.getObjective(userId as number, objectiveId),
      enabled: !!userId && !!objectiveId,
    },
    async () => null as FinancialObjectiveResponse | null,
  );

  const {
    data: payments,
    isLoading: loadingPayments,
    refetch: refetchPayments,
  } = useOfflineQuery(
    {
      queryKey: ["objective-payments", userId, objectiveId],
      queryFn: () => objectivesApi.getObjectivePayments(userId as number, objectiveId),
      enabled: !!userId && !!objectiveId,
    },
    async () => [] as ObjectivePaymentResponse[],
  );

  const isLoading = loadingObjective || loadingPayments;

  const payMutation = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note?: string }) =>
      objectivesApi.createObjectivePayment(
        userId as number,
        objectiveId,
        amount,
        new Date().toISOString().split("T")[0],
        note,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objective", userId, objectiveId] });
      queryClient.invalidateQueries({ queryKey: ["objective-payments", userId, objectiveId] });
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setShowPayModal(false);
      setPayAmount("");
      setPayNotes("");
      toast.success("Pago registrado");
    },
    onError: (err: unknown) => {
      toast.error("Error al registrar pago", err instanceof Error ? err.message : undefined);
    },
  });

  const refetchAll = useCallback(() => {
    refetchObjective();
    refetchPayments();
  }, [refetchObjective, refetchPayments]);

  function handlePay() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Monto inválido", "Ingresa un monto mayor a 0");
      return;
    }
    if (!isOnline) {
      toast.warning("Sin conexión", "Los pagos requieren conexión a internet");
      return;
    }
    payMutation.mutate({ amount, note: payNotes || undefined });
  }

  if (isLoading) return <DetailSkeleton />;

  if (!objective) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-4">
        <EmptyState
          icon={Search}
          title="Objetivo no encontrado"
          description="El objetivo que buscas no existe o fue eliminado"
        />
      </View>
    );
  }

  const target = objective.target_amount ?? 0;
  const pct =
    target > 0 ? Math.min(Math.round((objective.current_balance / target) * 100), 100) : 0;

  const remaining = Math.max(target - Number(objective.current_balance), 0);

  const targetDate = objective.end_date ? new Date(objective.end_date) : null;
  const now = new Date();
  const daysLeft = targetDate
    ? Math.max(Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0)
    : 0;

  const monthlyNeeded = daysLeft > 0 ? remaining / (daysLeft / 30) : 0;

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetchAll} />}
    >
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={20} color={PALETTE[resolvedScheme].foreground} />
        </Pressable>
        <Text className="text-lg font-display text-foreground flex-1" numberOfLines={1}>
          {objective.name}
        </Text>
      </View>

      {/* Objective Info */}
      <Card className="mx-4 mt-2">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-xl font-display text-foreground">{objective.name}</Text>
          </View>
          {objective.is_completed && <Badge tone="success">Completado</Badge>}
        </View>

        <View className="flex-row items-baseline mb-3">
          <Text className="text-3xl font-num-semibold text-foreground">
            {formatCOP(Number(objective.current_balance))}
          </Text>
          <Text className="text-muted-foreground font-sans ml-1"> / </Text>
          <Text className="text-lg font-sans text-muted-foreground">{formatCOP(target)}</Text>
        </View>

        <ProgressBar value={Number(objective.current_balance)} total={target} />

        <View className="flex-row justify-between items-center mt-3">
          <Text className="text-sm font-sans text-muted-foreground">{pct}% completado</Text>
        </View>
      </Card>

      {/* Progress Details */}
      <Card className="mx-4 mt-3">
        <Text className="text-sm font-sans-bold text-foreground mb-3">Detalles del progreso</Text>
        <View className="gap-2">
          {[
            { label: "Monto restante", value: formatCOP(remaining), tone: "warning" as const },
            {
              label: "Fecha objetivo",
              value: targetDate ? targetDate.toLocaleDateString("es-CO") : "Sin definir",
              tone: "muted" as const,
            },
            { label: "Días restantes", value: `${daysLeft} días`, tone: "muted" as const },
            { label: "Cuota mensual sugerida", value: formatCOP(monthlyNeeded), tone: "primary" as const },
          ].map(({ label, value, tone }) => (
            <View
              key={label}
              className="flex-row justify-between items-center py-2 border-b border-border last:border-0"
            >
              <Text className="text-sm font-sans text-muted-foreground">{label}</Text>
              <Badge tone={tone}>{value}</Badge>
            </View>
          ))}
        </View>
      </Card>

      {/* Payment History */}
      <Card className="mx-4 mt-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-sm font-sans-bold text-foreground">Historial de pagos</Text>
          <Badge tone="muted">{(payments ?? []).length} pagos</Badge>
        </View>

        {(payments ?? []).length === 0 ? (
          <EmptyState icon={PiggyBank} title="Aún no has registrado pagos" />
        ) : (
          (payments ?? []).map((payment) => (
            <View
              key={payment.id}
              className="flex-row justify-between items-center py-3 border-b border-border last:border-0"
            >
              <View className="flex-1">
                <Text className="text-sm font-sans-semibold text-foreground">
                  {formatCOP(Number(payment.amount))}
                </Text>
                {payment.note && (
                  <Text className="text-xs font-sans text-muted-foreground mt-0.5">
                    {payment.note}
                  </Text>
                )}
              </View>
              <Text className="text-xs font-sans text-muted-foreground">
                {new Date(payment.payment_date).toLocaleDateString("es-CO")}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Pay Button */}
      {!objective.is_completed && (
        <View className="mx-4 mt-4 mb-8">
          <Button size="lg" onPress={() => setShowPayModal(true)}>
            Registrar pago
          </Button>
        </View>
      )}

      {/* Payment Modal */}
      <Modal
        visible={showPayModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPayModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[60%]">
            <Text className="text-lg font-display text-foreground mb-5">Registrar pago</Text>
            <CurrencyInput
              label="Monto a pagar"
              value={payAmount}
              onChangeValue={setPayAmount}
              placeholder="100000"
            />
            <Input
              label="Notas (opcional)"
              value={payNotes}
              onChangeText={setPayNotes}
              placeholder="Pago mensual..."
            />
            <View className="flex-row gap-3 mt-4">
              <Button variant="outline" className="flex-1" onPress={() => setShowPayModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" loading={payMutation.isPending} onPress={handlePay}>
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
