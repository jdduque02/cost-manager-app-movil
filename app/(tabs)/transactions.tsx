import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useState, useMemo, useEffect } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as catalogApi from "@/api/catalog.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  TransactionType,
} from "@/types/transaction.types";
import type { CategoryResponse } from "@/types/catalog.types";
import { Card } from "@/components/ui/Card";
import { type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { StaleDataBanner } from "@/components/StaleDataBanner";
import { useReducedMotion, EASE_IN_OUT_STRONG, CROSSFADE_DURATION } from "@/utils/animations";
import {
  Plus,
  TrendingUp,
  ShoppingBag,
  PiggyBank,
  ArrowLeftRight,
  ReceiptText,
  type LucideIcon,
} from "@/components/ui/icons";

type Tab = "lista" | "calendario";

const TAB_OPTIONS: SegmentedOption<Tab>[] = [
  { value: "lista", label: "Lista" },
  { value: "calendario", label: "Calendario" },
];

const TRANSACTION_TYPES: TransactionType[] = [
  "income",
  "expense",
  "investment",
  "transfer",
];

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
  transfer: "Transferencia",
};

const TYPE_TONE: Record<TransactionType, BadgeTone> = {
  income: "success",
  expense: "destructive",
  investment: "primary",
  transfer: "info",
};

const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  income: TrendingUp,
  expense: ShoppingBag,
  investment: PiggyBank,
  transfer: ArrowLeftRight,
};

const TYPE_AMOUNT_CLASS: Record<TransactionType, string> = {
  income: "text-success",
  expense: "text-destructive",
  investment: "text-primary",
  transfer: "text-info",
};

function groupByMonth(
  transactions: TransactionRecordResponse[],
): Record<string, TransactionRecordResponse[]> {
  const groups: Record<string, TransactionRecordResponse[]> = {};
  for (const tx of transactions) {
    const key = new Date(tx.transaction_date).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

/**
 * Cross-fade de entrada para el contenido activo del toggle Lista/Calendario.
 * FlatList y ScrollView son árboles distintos: al cambiar de tab, React
 * desmonta uno y monta el otro (no hay una superposición real de ambos), así
 * que en vez de un crossfade simétrico de dos capas (que arriesga duplicar
 * `refreshControl`/scroll), este componente hace un fade-in desde 0 en cada
 * montaje — evita el salto brusco sin tocar el scroll/refresh de cada rama.
 */
function FadeInContent({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: CROSSFADE_DURATION, easing: EASE_IN_OUT_STRONG });
    // Solo al montar: cada cambio de tab crea una instancia nueva de este componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>;
}

export default function TransactionsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createTransaction: createOffline, deleteTransaction: deleteOffline } =
    useOfflineMutations();
  const { resolvedScheme } = useAppTheme();

  const [activeTab, setActiveTab] = useState<Tab>("lista");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [form, setForm] = useState<Partial<CreateTransactionRecordDto>>({
    type: "expense",
    currency: "COP",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading, refetch, isUsingFallback } = useOfflineQuery(
    {
      // Sufijo "list" — ver comentario equivalente en app/(tabs)/index.tsx.
      queryKey: ["transactions", userId, "list"],
      queryFn: () =>
        transactionsApi.getTransactions(userId as number, { limit: 200, page: 1 }),
      enabled: !!userId,
    },
    async () => {
      const rows = await localRepo.getLocalTransactions(userId as number);
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

  const filteredTransactions = useMemo(() => {
    const list = data?.data ?? [];
    let result = list;
    if (typeFilter !== "ALL") {
      result = result.filter((tx) => tx.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(q) ||
          String(tx.amount).includes(q),
      );
    }
    return result;
  }, [data, typeFilter, searchQuery]);

  const calendarData = useMemo(
    () => groupByMonth(filteredTransactions),
    [filteredTransactions],
  );

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
      setShowCreateModal(false);
      setCategorySearch("");
      setForm({
        type: "expense",
        currency: "COP",
        transaction_date: new Date().toISOString().split("T")[0],
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
    mutationFn: (id: number) => deleteOffline(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] }),
  });

  function handleCreate() {
    if (!form.amount || !form.category_id || !form.type) {
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

  function renderTransactionItem({
    item,
    index,
  }: {
    item: TransactionRecordResponse;
    index: number;
  }) {
    return (
      <AnimatedListItem index={index} className="mb-2">
        <Card variant="flat" className="p-2" onPress={() => confirmDelete(item.id)}>
          <ListRow
            icon={TYPE_ICON[item.type]}
            tone={TYPE_TONE[item.type]}
            title={item.description ?? `Transacción #${item.id}`}
            meta={new Date(item.transaction_date).toLocaleDateString("es-CO")}
            amount={Number(item.amount)}
            amountPrefix={item.type === "income" ? "+" : "-"}
            amountClassName={TYPE_AMOUNT_CLASS[item.type]}
          />
        </Card>
      </AnimatedListItem>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-4">
        <Skeleton width={180} height={28} className="mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={64} borderRadius={12} className="mb-2" />
        ))}
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <EmptyState
          icon={ReceiptText}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para ver tus datos."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {isUsingFallback && <StaleDataBanner onRetry={refetch} />}

      <View className="px-4 pt-4 pb-2">
        <PageHeader
          title="Transacciones"
          actions={
            <Button size="sm" onPress={() => setShowCreateModal(true)}>
              <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
              <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
            </Button>
          }
        />
      </View>

      {/* Tab bar */}
      <View className="px-4 pb-3">
        <SegmentedControl options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
      </View>

      {/* Search */}
      <View className="px-4 pb-3">
        <Input
          placeholder="Buscar transacciones..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="mb-0"
        />
      </View>

      {/* Filter chips */}
      <View className="flex-row flex-wrap px-4 gap-2 mb-3">
        <Chip
          label="Todas"
          shape="pill"
          size="sm"
          selected={typeFilter === "ALL"}
          onPress={() => setTypeFilter("ALL")}
        />
        {TRANSACTION_TYPES.map((t) => (
          <Chip
            key={t}
            label={TYPE_LABELS[t]}
            shape="pill"
            size="sm"
            selected={typeFilter === t}
            onPress={() => setTypeFilter(t)}
          />
        ))}
      </View>

      {/* Content */}
      {activeTab === "lista" ? (
        <FadeInContent key="lista">
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTransactionItem}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            ListEmptyComponent={
              <EmptyState
                icon={ReceiptText}
                title="Sin transacciones"
                description="No se encontraron movimientos."
              />
            }
          />
        </FadeInContent>
      ) : (
        <FadeInContent key="calendario">
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          >
            {Object.keys(calendarData).length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Sin transacciones"
                description="No hay movimientos para mostrar."
              />
            ) : (
              Object.entries(calendarData).map(([month, txs], monthIndex) => (
                <AnimatedListItem key={month} index={monthIndex} delay={80} className="mb-4">
                  <Text className="text-sm font-sans-bold text-foreground mb-2 uppercase">
                    {month}
                  </Text>
                  <Card variant="flat" className="p-2">
                    {txs.map((tx) => (
                      <ListRow
                        key={tx.id}
                        icon={TYPE_ICON[tx.type]}
                        tone={TYPE_TONE[tx.type]}
                        title={tx.description ?? `#${tx.id}`}
                        meta={new Date(tx.transaction_date).toLocaleDateString("es-CO")}
                        amount={Number(tx.amount)}
                        amountPrefix={tx.type === "income" ? "+" : "-"}
                        amountClassName={TYPE_AMOUNT_CLASS[tx.type]}
                        onLongPress={() => confirmDelete(tx.id)}
                      />
                    ))}
                  </Card>
                </AnimatedListItem>
              ))
            )}
          </ScrollView>
        </FadeInContent>
      )}

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCreateModal(false);
          setCategorySearch("");
        }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">
              Nueva transacción
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <Text className="text-sm font-sans-medium text-foreground mb-1.5">Tipo</Text>
              <View className="flex-row gap-2 mb-4">
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
                label="Descripción (opcional)"
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

              <View className="flex-row gap-3 mt-2 mb-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setShowCreateModal(false);
                    setCategorySearch("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  loading={createMutation.isPending}
                  onPress={handleCreate}
                >
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
