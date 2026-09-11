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
import { useState, useMemo, useEffect } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as catalogApi from "@/api/catalog.api";
import * as objectivesApi from "@/api/objectives.api";
import * as empresasApi from "@/api/empresas.api";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { formatCurrency } from "@/utils/format";
import type {
  TransactionRecordResponse,
  CreateTransactionRecordDto,
  TransactionType,
  FixedType,
  FixedFrequency,
  PatrimonyKind,
} from "@/types/transaction.types";
import type {
  CategoryResponse,
  SubcategoryResponse,
} from "@/types/catalog.types";
import type { FinancialObjectiveType } from "@/types/objective.types";
import { Card } from "@/components/ui/Card";
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
import { TransferModal } from "@/components/transactions/TransferModal";
import { CloneTransactionModal } from "@/components/transactions/CloneTransactionModal";
import { useReducedMotion, EASE_IN_OUT_STRONG, CROSSFADE_DURATION } from "@/utils/animations";
import { Plus, ReceiptText, Copy, Check, ArrowLeftRight } from "@/components/ui/icons";
import {
  TRANSACTION_TYPES,
  TYPE_LABELS,
  TYPE_TONE,
  TYPE_ICON,
  TYPE_AMOUNT_CLASS,
  TYPE_TO_GROUP_TYPE,
} from "@/utils/transaction-labels";
import {
  PAYMENT_METHOD_OPTIONS,
  FIXED_TYPE_LABELS,
  FIXED_FREQUENCY_LABELS,
  defaultFixedType,
  patrimonyKindOf,
  clearPatrimonyFields,
  setPatrimony,
  validateFixedAndInstallments,
} from "@/utils/transaction-form";

const PATRIMONY_OPTIONS: SegmentedOption<PatrimonyKind>[] = [
  { value: "account", label: "Cuenta" },
  { value: "asset", label: "Activo" },
  { value: "liability", label: "Pasivo" },
];

const OBJECTIVE_TYPE_OPTIONS: { value: FinancialObjectiveType; label: string }[] = [
  { value: "goal", label: "Meta" },
  { value: "savings", label: "Ahorro" },
  { value: "loan", label: "Préstamo" },
];

type Tab = "lista" | "calendario";

const TAB_OPTIONS: SegmentedOption<Tab>[] = [
  { value: "lista", label: "Lista" },
  { value: "calendario", label: "Calendario" },
];

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
  const {
    createTransaction: createOffline,
    deleteTransaction: deleteOffline,
    createObjective,
    createCompany,
  } = useOfflineMutations();
  const { resolvedScheme } = useAppTheme();

  const [activeTab, setActiveTab] = useState<Tab>("lista");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showCreateSubcategoryModal, setShowCreateSubcategoryModal] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({ name: "", icon_key: "" });
  const [newSubcategoryForm, setNewSubcategoryForm] = useState({ name: "", icon_key: "" });
  const [showCreateObjectiveModal, setShowCreateObjectiveModal] = useState(false);
  const [newObjectiveForm, setNewObjectiveForm] = useState<{
    name: string;
    type: FinancialObjectiveType;
    target_amount: string;
  }>({ name: "", type: "goal", target_amount: "" });
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ name: "" });
  const [patrimonyTab, setPatrimonyTab] = useState<PatrimonyKind>("account");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<TransactionRecordResponse | null>(null);
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

  const { data: subcategories } = useOfflineQuery(
    {
      queryKey: ["subcategories", form.category_id],
      queryFn: () =>
        form.category_id && userId
          ? catalogApi.getSubcategories(userId, form.category_id)
          : Promise.resolve([]),
      enabled: !!form.category_id && !!userId,
    },
    () =>
      form.category_id
        ? localRepo.getLocalSubcategories(form.category_id)
        : Promise.resolve([]),
  );

  const { data: objectives } = useOfflineQuery(
    {
      queryKey: ["objectives", userId],
      queryFn: () => objectivesApi.getObjectives(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalObjectives(userId as number),
  );

  const { data: companies } = useOfflineQuery(
    {
      queryKey: ["companies", userId],
      queryFn: () => empresasApi.getEmpresas(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalCompanies(userId as number),
  );

  const { data: bankAccounts } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalBankAccounts(userId as number),
  );

  const { data: financialAssets } = useOfflineQuery(
    {
      queryKey: ["financial-assets", userId],
      queryFn: () => bankingApi.getFinancialAssets(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalFinancialAssets(userId as number),
  );

  const { data: financialLiabilities } = useOfflineQuery(
    {
      queryKey: ["financial-liabilities", userId],
      queryFn: () => bankingApi.getFinancialLiabilities(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalFinancialLiabilities(userId as number),
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

  const filteredSubcategories = useMemo(() => {
    const list = subcategories ?? [];
    if (!subcategorySearch.trim()) return list;
    const q = subcategorySearch.toLowerCase();
    return list.filter((sub: SubcategoryResponse) => sub.name.toLowerCase().includes(q));
  }, [subcategories, subcategorySearch]);

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionRecordDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      setShowCreateModal(false);
      setCategorySearch("");
      setSubcategorySearch("");
      setPatrimonyTab("account");
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

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      catalogApi.createCategory({
        name: newCategoryForm.name.trim(),
        group_type: TYPE_TO_GROUP_TYPE[form.type ?? "expense"],
        icon_key: newCategoryForm.icon_key.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setForm((p) => ({ ...p, category_id: created.id, subcategory_id: undefined }));
      setCategorySearch("");
      setSubcategorySearch("");
      setShowCreateCategoryModal(false);
      setNewCategoryForm({ name: "", icon_key: "" });
    },
    onError: () => Alert.alert("Error", "No se pudo crear la categoría"),
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: () =>
      catalogApi.createSubcategory(userId as number, {
        category_id: form.category_id as number,
        name: newSubcategoryForm.name.trim(),
        icon_key: newSubcategoryForm.icon_key.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["subcategories", form.category_id] });
      setForm((p) => ({ ...p, subcategory_id: created.id }));
      setSubcategorySearch("");
      setShowCreateSubcategoryModal(false);
      setNewSubcategoryForm({ name: "", icon_key: "" });
    },
    onError: () => Alert.alert("Error", "No se pudo crear la subcategoría"),
  });

  function handleCreateCategory() {
    if (!newCategoryForm.name.trim()) {
      Alert.alert("Campo requerido", "El nombre de la categoría es obligatorio");
      return;
    }
    createCategoryMutation.mutate();
  }

  function handleCreateSubcategory() {
    if (!newSubcategoryForm.name.trim() || !form.category_id) {
      Alert.alert("Campo requerido", "El nombre de la subcategoría es obligatorio");
      return;
    }
    createSubcategoryMutation.mutate();
  }

  const createObjectiveMutation = useMutation({
    mutationFn: () =>
      createObjective({
        name: newObjectiveForm.name.trim(),
        type: newObjectiveForm.type,
        target_amount: newObjectiveForm.target_amount
          ? parseFloat(newObjectiveForm.target_amount)
          : undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setForm((p) => ({ ...p, objective_id: created.id }));
      setShowCreateObjectiveModal(false);
      setNewObjectiveForm({ name: "", type: "goal", target_amount: "" });
    },
    onError: () => Alert.alert("Error", "No se pudo crear la meta"),
  });

  function handleCreateObjective() {
    if (!newObjectiveForm.name.trim()) {
      Alert.alert("Campo requerido", "El nombre de la meta es obligatorio");
      return;
    }
    createObjectiveMutation.mutate();
  }

  const createCompanyMutation = useMutation({
    mutationFn: () => createCompany({ name: newCompanyForm.name.trim() }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["companies", userId] });
      setForm((p) => ({ ...p, company_id: created.id }));
      setShowCreateCompanyModal(false);
      setNewCompanyForm({ name: "" });
    },
    onError: () => Alert.alert("Error", "No se pudo crear la empresa"),
  });

  function handleCreateCompany() {
    if (!newCompanyForm.name.trim()) {
      Alert.alert("Campo requerido", "El nombre de la empresa es obligatorio");
      return;
    }
    createCompanyMutation.mutate();
  }

  const cloneMutation = useMutation({
    mutationFn: (overrides: {
      transaction_date?: string;
      amount?: number;
      description?: string;
    }) => transactionsApi.cloneTransaction(userId as number, cloneTarget!.id, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      setCloneTarget(null);
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "No se pudo duplicar la transacción",
      );
    },
  });

  function handleClonePress(tx: TransactionRecordResponse) {
    if (!isOnline) {
      Alert.alert("Sin conexión", "Duplicar una transacción requiere conexión a internet");
      return;
    }
    setCloneTarget(tx);
  }

  function handleCreate() {
    if (!form.amount || !form.category_id || !form.type) {
      Alert.alert(
        "Campos requeridos",
        "Monto, categoría y tipo son obligatorios",
      );
      return;
    }
    if (form.amount <= 0) {
      Alert.alert("Monto inválido", "El monto debe ser mayor a 0");
      return;
    }
    const fixedError = validateFixedAndInstallments(form);
    if (fixedError) {
      Alert.alert("Campo inválido", fixedError);
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

  /** Monto + botón de duplicar, reemplaza el `right` por defecto de `ListRow`. */
  function renderRowRight(tx: TransactionRecordResponse) {
    return (
      <View className="flex-row items-center gap-2">
        <Text
          className={`text-sm font-num-semibold ${TYPE_AMOUNT_CLASS[tx.type]}`}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {tx.type === "income" ? "+" : "-"}
          {formatCurrency(Number(tx.amount))}
        </Text>
        <Pressable onPress={() => handleClonePress(tx)} hitSlop={8} accessibilityLabel="Duplicar transacción">
          <Copy size={16} color={PALETTE[resolvedScheme].mutedForeground} />
        </Pressable>
      </View>
    );
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
            right={renderRowRight(item)}
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
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" onPress={() => setShowTransferModal(true)}>
                <ArrowLeftRight size={16} color={PALETTE[resolvedScheme].foreground} />
                <Text className="text-sm font-sans-medium text-foreground">Transferir</Text>
              </Button>
              <Button size="sm" onPress={() => setShowCreateModal(true)}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
              </Button>
            </View>
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
                        right={renderRowRight(tx)}
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
          setSubcategorySearch("");
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

              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-sans-medium text-foreground">Categoría</Text>
                <Pressable onPress={() => setShowCreateCategoryModal(true)}>
                  <Text className="text-xs font-sans-medium text-primary">+ Nueva categoría</Text>
                </Pressable>
              </View>
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
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          category_id: cat.id,
                          subcategory_id:
                            p.category_id === cat.id ? p.subcategory_id : undefined,
                        }))
                      }
                      className="mr-2"
                    />
                  ))
                )}
              </ScrollView>

              {form.category_id && (
                <>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-sm font-sans-medium text-foreground">
                      Subcategoría (opcional)
                    </Text>
                    <Pressable onPress={() => setShowCreateSubcategoryModal(true)}>
                      <Text className="text-xs font-sans-medium text-primary">
                        + Nueva subcategoría
                      </Text>
                    </Pressable>
                  </View>
                  <Input
                    value={subcategorySearch}
                    onChangeText={setSubcategorySearch}
                    placeholder="Buscar subcategoría..."
                    className="mb-2"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    {filteredSubcategories.length === 0 ? (
                      <Text className="text-sm font-sans text-muted-foreground py-2">
                        Sin subcategorías
                      </Text>
                    ) : (
                      filteredSubcategories.map((sub: SubcategoryResponse) => (
                        <Chip
                          key={sub.id}
                          label={sub.name}
                          selected={form.subcategory_id === sub.id}
                          onPress={() =>
                            setForm((p) => ({
                              ...p,
                              subcategory_id: p.subcategory_id === sub.id ? undefined : sub.id,
                            }))
                          }
                          className="mr-2"
                        />
                      ))
                    )}
                  </ScrollView>
                </>
              )}

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

              <Text className="text-sm font-sans-medium text-foreground mb-1.5">
                Método de pago (opcional)
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {PAYMENT_METHOD_OPTIONS.map((pm) => (
                  <Chip
                    key={pm.value}
                    label={pm.label}
                    size="sm"
                    selected={form.payment_method === pm.value}
                    onPress={() =>
                      setForm((p) => {
                        const next = p.payment_method === pm.value ? undefined : pm.value;
                        return {
                          ...p,
                          payment_method: next,
                          installments: next === "credit_card" ? p.installments : undefined,
                          installment_value:
                            next === "credit_card" ? p.installment_value : undefined,
                        };
                      })
                    }
                  />
                ))}
              </View>

              {form.payment_method === "credit_card" && (
                <>
                  <Input
                    label="Número de cuotas"
                    keyboardType="number-pad"
                    value={form.installments != null ? String(form.installments) : ""}
                    onChangeText={(v) =>
                      setForm((p) => ({
                        ...p,
                        installments: v ? parseInt(v, 10) : undefined,
                      }))
                    }
                    placeholder="1"
                  />
                  <CurrencyInput
                    label="Valor por cuota (opcional)"
                    value={
                      form.installment_value != null ? String(form.installment_value) : ""
                    }
                    onChangeValue={(raw) =>
                      setForm((p) => ({
                        ...p,
                        installment_value: raw ? parseFloat(raw) : undefined,
                      }))
                    }
                    placeholder="0"
                  />
                </>
              )}

              <Pressable
                onPress={() =>
                  setForm((p) => {
                    const nextFixed = !p.is_fixed;
                    return nextFixed
                      ? {
                          ...p,
                          is_fixed: true,
                          fixed_type: p.fixed_type ?? defaultFixedType(p.type ?? "expense"),
                        }
                      : { ...p, is_fixed: false };
                  })
                }
                className="flex-row items-center gap-2 mb-3"
              >
                <View
                  className={`w-5 h-5 rounded border items-center justify-center ${
                    form.is_fixed ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {form.is_fixed && (
                    <Check size={14} color={PALETTE[resolvedScheme].primaryForeground} />
                  )}
                </View>
                <Text className="text-sm font-sans-medium text-foreground">
                  Transacción fija
                </Text>
              </Pressable>

              {form.is_fixed && (
                <View className="mb-2 pl-1">
                  <Text className="text-sm font-sans-medium text-foreground mb-1.5">Tipo</Text>
                  <View className="flex-row gap-2 mb-3">
                    {(Object.keys(FIXED_TYPE_LABELS) as FixedType[]).map((ft) => (
                      <Chip
                        key={ft}
                        label={FIXED_TYPE_LABELS[ft]}
                        size="sm"
                        selected={form.fixed_type === ft}
                        onPress={() => setForm((p) => ({ ...p, fixed_type: ft }))}
                      />
                    ))}
                  </View>

                  <Text className="text-sm font-sans-medium text-foreground mb-1.5">
                    Periodicidad
                  </Text>
                  <View className="flex-row gap-2 mb-3">
                    {(Object.keys(FIXED_FREQUENCY_LABELS) as FixedFrequency[]).map((f) => (
                      <Chip
                        key={f}
                        label={FIXED_FREQUENCY_LABELS[f]}
                        size="sm"
                        selected={form.frequency === f}
                        onPress={() => setForm((p) => ({ ...p, frequency: f }))}
                      />
                    ))}
                  </View>

                  <Input
                    label="Día de vencimiento (1-31)"
                    keyboardType="number-pad"
                    value={form.due_day != null ? String(form.due_day) : ""}
                    onChangeText={(v) =>
                      setForm((p) => ({ ...p, due_day: v ? parseInt(v, 10) : undefined }))
                    }
                    placeholder="5"
                  />
                  <Input
                    label="Días de anticipación del recordatorio (0-30)"
                    keyboardType="number-pad"
                    value={form.reminder_days != null ? String(form.reminder_days) : ""}
                    onChangeText={(v) =>
                      setForm((p) => ({
                        ...p,
                        reminder_days: v ? parseInt(v, 10) : undefined,
                      }))
                    }
                    placeholder="3"
                  />

                  {form.fixed_type !== "fixed_income" && (
                    <>
                      <Input
                        label="Banco/entidad de origen (opcional)"
                        value={form.source_bank ?? ""}
                        onChangeText={(v) => setForm((p) => ({ ...p, source_bank: v }))}
                        placeholder="Ej: Bancolombia"
                      />
                      <Input
                        label="Cuenta/referencia de origen (opcional)"
                        value={form.source_account ?? ""}
                        onChangeText={(v) => setForm((p) => ({ ...p, source_account: v }))}
                        placeholder="Ej: Nómina"
                      />
                    </>
                  )}
                </View>
              )}

              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-sans-medium text-foreground">
                  Meta/objetivo asociado (opcional)
                </Text>
                <Pressable onPress={() => setShowCreateObjectiveModal(true)}>
                  <Text className="text-xs font-sans-medium text-primary">+ Nueva meta</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {(objectives ?? []).length === 0 ? (
                  <Text className="text-sm font-sans text-muted-foreground py-2">
                    Sin metas registradas
                  </Text>
                ) : (
                  (objectives ?? []).map((o) => (
                    <Chip
                      key={o.id}
                      label={o.name}
                      selected={form.objective_id === o.id}
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          objective_id: p.objective_id === o.id ? undefined : o.id,
                        }))
                      }
                      className="mr-2"
                    />
                  ))
                )}
              </ScrollView>

              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-sans-medium text-foreground">
                  Empresa asociada (opcional)
                </Text>
                <Pressable onPress={() => setShowCreateCompanyModal(true)}>
                  <Text className="text-xs font-sans-medium text-primary">+ Nueva empresa</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {(companies ?? []).length === 0 ? (
                  <Text className="text-sm font-sans text-muted-foreground py-2">
                    Sin empresas registradas
                  </Text>
                ) : (
                  (companies ?? []).map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={form.company_id === c.id}
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          company_id: p.company_id === c.id ? undefined : c.id,
                        }))
                      }
                      className="mr-2"
                    />
                  ))
                )}
              </ScrollView>

              <Text className="text-sm font-sans-medium text-foreground mb-1.5">
                Patrimonio asociado (opcional)
              </Text>
              <View className="mb-3">
                <SegmentedControl
                  options={PATRIMONY_OPTIONS}
                  value={patrimonyTab}
                  onChange={setPatrimonyTab}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {patrimonyTab === "account" &&
                  ((bankAccounts ?? []).length === 0 ? (
                    <Text className="text-sm font-sans text-muted-foreground py-2">
                      Sin cuentas registradas
                    </Text>
                  ) : (
                    (bankAccounts ?? []).map((a) => (
                      <Chip
                        key={a.id}
                        label={`${a.bank_name} ${a.masked_account_number}`}
                        selected={form.account_id === a.id}
                        onPress={() =>
                          setForm((p) =>
                            patrimonyKindOf(p) === "account" && p.account_id === a.id
                              ? clearPatrimonyFields(p)
                              : setPatrimony(p, "account", a.id),
                          )
                        }
                        className="mr-2"
                      />
                    ))
                  ))}
                {patrimonyTab === "asset" &&
                  ((financialAssets ?? []).length === 0 ? (
                    <Text className="text-sm font-sans text-muted-foreground py-2">
                      Sin activos registrados
                    </Text>
                  ) : (
                    (financialAssets ?? []).map((a) => (
                      <Chip
                        key={a.id}
                        label={a.name}
                        selected={form.asset_id === a.id}
                        onPress={() =>
                          setForm((p) =>
                            patrimonyKindOf(p) === "asset" && p.asset_id === a.id
                              ? clearPatrimonyFields(p)
                              : setPatrimony(p, "asset", a.id),
                          )
                        }
                        className="mr-2"
                      />
                    ))
                  ))}
                {patrimonyTab === "liability" &&
                  ((financialLiabilities ?? []).length === 0 ? (
                    <Text className="text-sm font-sans text-muted-foreground py-2">
                      Sin pasivos registrados
                    </Text>
                  ) : (
                    (financialLiabilities ?? []).map((l) => (
                      <Chip
                        key={l.id}
                        label={l.name}
                        selected={form.liability_id === l.id}
                        onPress={() =>
                          setForm((p) =>
                            patrimonyKindOf(p) === "liability" && p.liability_id === l.id
                              ? clearPatrimonyFields(p)
                              : setPatrimony(p, "liability", l.id),
                          )
                        }
                        className="mr-2"
                      />
                    ))
                  ))}
              </ScrollView>

              <View className="flex-row gap-3 mt-2 mb-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setShowCreateModal(false);
                    setCategorySearch("");
                    setSubcategorySearch("");
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

      {/* Create Category Modal (rápido, desde el registro de transacciones) */}
      <Modal
        visible={showCreateCategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateCategoryModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-1">Nueva categoría</Text>
            <Text className="text-sm font-sans text-muted-foreground mb-5">
              Se creará como {TYPE_LABELS[form.type ?? "expense"]}
            </Text>
            <Input
              label="Nombre"
              value={newCategoryForm.name}
              onChangeText={(v) => setNewCategoryForm((p) => ({ ...p, name: v }))}
              placeholder="Transporte"
            />
            <Input
              label="Icono (emoji, opcional)"
              value={newCategoryForm.icon_key}
              onChangeText={(v) => setNewCategoryForm((p) => ({ ...p, icon_key: v }))}
              placeholder="🚗"
            />
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowCreateCategoryModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={createCategoryMutation.isPending}
                onPress={handleCreateCategory}
              >
                Crear
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Subcategory Modal (rápido, desde el registro de transacciones) */}
      <Modal
        visible={showCreateSubcategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateSubcategoryModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-1">Nueva subcategoría</Text>
            <Text className="text-sm font-sans text-muted-foreground mb-5">
              En: {categories?.find((c: CategoryResponse) => c.id === form.category_id)?.name}
            </Text>
            <Input
              label="Nombre"
              value={newSubcategoryForm.name}
              onChangeText={(v) => setNewSubcategoryForm((p) => ({ ...p, name: v }))}
              placeholder="Nombre de la subcategoría"
            />
            <Input
              label="Icono (emoji, opcional)"
              value={newSubcategoryForm.icon_key}
              onChangeText={(v) => setNewSubcategoryForm((p) => ({ ...p, icon_key: v }))}
              placeholder="•"
            />
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowCreateSubcategoryModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={createSubcategoryMutation.isPending}
                onPress={handleCreateSubcategory}
              >
                Crear
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Objective Modal (rápido, desde el registro de transacciones) */}
      <Modal
        visible={showCreateObjectiveModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateObjectiveModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">Nueva meta</Text>
            <Input
              label="Nombre"
              value={newObjectiveForm.name}
              onChangeText={(v) => setNewObjectiveForm((p) => ({ ...p, name: v }))}
              placeholder="Ej: Vacaciones"
            />
            <Text className="text-sm font-sans-medium text-foreground mb-1.5">Tipo</Text>
            <View className="flex-row gap-2 mb-4">
              {OBJECTIVE_TYPE_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={newObjectiveForm.type === o.value}
                  onPress={() => setNewObjectiveForm((p) => ({ ...p, type: o.value }))}
                />
              ))}
            </View>
            <CurrencyInput
              label="Monto objetivo (opcional)"
              value={newObjectiveForm.target_amount}
              onChangeValue={(raw) =>
                setNewObjectiveForm((p) => ({ ...p, target_amount: raw }))
              }
              placeholder="0"
            />
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowCreateObjectiveModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={createObjectiveMutation.isPending}
                onPress={handleCreateObjective}
              >
                Crear
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Company Modal (rápido, desde el registro de transacciones) */}
      <Modal
        visible={showCreateCompanyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateCompanyModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">Nueva empresa</Text>
            <Input
              label="Nombre"
              value={newCompanyForm.name}
              onChangeText={(v) => setNewCompanyForm({ name: v })}
              placeholder="Ej: Netflix"
            />
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowCreateCompanyModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={createCompanyMutation.isPending}
                onPress={handleCreateCompany}
              >
                Crear
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <TransferModal
        visible={showTransferModal}
        userId={userId}
        isOnline={isOnline}
        bankAccounts={bankAccounts ?? []}
        liabilities={financialLiabilities ?? []}
        onClose={() => setShowTransferModal(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["transactions", userId] })}
      />

      <CloneTransactionModal
        visible={!!cloneTarget}
        transaction={cloneTarget}
        isPending={cloneMutation.isPending}
        onClose={() => setCloneTarget(null)}
        onConfirm={(overrides) => cloneMutation.mutate(overrides)}
      />
    </View>
  );
}
