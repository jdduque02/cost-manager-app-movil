import { useState } from "react";
import { View, Text, ScrollView, Modal, Pressable, RefreshControl } from "react-native";
import { Redirect, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import * as recurringApi from "@/api/recurring.api";
import * as catalogApi from "@/api/catalog.api";
import * as bankingApi from "@/api/banking.api";
import { apiErrorMessage } from "@/api/client";
import * as localRepo from "@/database/local.repository";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { StaleDataBanner } from "@/components/StaleDataBanner";
import { ArrowLeft, Plus, Pencil, Trash, RefreshCw, WifiOff } from "@/components/ui/icons";
import { formatCurrency } from "@/utils/format";
import { toast } from "@/utils/toast";
import { TX_CURRENCIES, fxNotice, FX_APPROX_NOTE } from "@/utils/transaction-form";
import type {
  CreateRecurringTransactionDto,
  RecurringFrequency,
  RecurringMode,
  RecurringStatus,
  RecurringTransaction,
  UpdateRecurringTransactionDto,
} from "@/types/recurring.types";

/**
 * Recurrentes (R6.1, R8.1, R8.4, R8.5). La lista sale del caché SQLite sin
 * conexión; crear, editar y cancelar van directo al API y SOLO con conexión:
 * no pasan por `pending_operations` (el API procesa al escribir y una
 * ocurrencia encolada podría duplicarse). El invitado no tiene cuenta en el API.
 */

type Kind = "income" | "expense" | "investment" | "transfer" | "debt";
type Link = "account" | "liability";
type EndKind = "none" | "date" | "count";
type StatusFilter = RecurringStatus | "all";

const KIND_LABELS: Record<Kind, string> = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
  transfer: "Transferencia entre cuentas",
  debt: "Pago de deuda",
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const STATUS_LABELS: Record<RecurringStatus, string> = {
  active: "Activo",
  cancelled: "Cancelado",
  finished: "Finalizado",
};

const STATUS_TONE = { active: "success", cancelled: "muted", finished: "info" } as const;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "finished", label: "Finalizados" },
  { value: "all", label: "Todos" },
];

const LINK_OPTIONS: SegmentedOption<Link>[] = [
  { value: "account", label: "Cuenta" },
  { value: "liability", label: "Pasivo" },
];

const MODE_OPTIONS: SegmentedOption<RecurringMode>[] = [
  { value: "auto", label: "Automático" },
  { value: "confirm", label: "Por confirmar" },
];

const END_OPTIONS: SegmentedOption<EndKind>[] = [
  { value: "none", label: "Sin fin" },
  { value: "date", label: "En fecha" },
  { value: "count", label: "N veces" },
];

const OFFLINE_MESSAGE = "Necesitas conexión para crear, editar o cancelar recurrentes";

/** Fecha local `YYYY-MM-DD` (no UTC: de noche en Bogotá `toISOString` ya es mañana). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface FormState {
  kind: Kind;
  name: string;
  amount: string;
  /** Solo ingresos. Sin elegir (`undefined`) rige la moneda de la cuenta/pasivo y no se envía. */
  currency?: TxCurrency;
  categoryId?: number;
  link: Link;
  accountId?: number;
  liabilityId?: number;
  originId?: number;
  destAccountId?: number;
  destLiabilityId?: number;
  frequency: RecurringFrequency;
  startDate: string;
  mode: RecurringMode;
  reminderDays: string;
  endKind: EndKind;
  endDate: string;
  maxOccurrences: string;
}

function emptyForm(): FormState {
  return {
    kind: "expense",
    name: "",
    amount: "",
    link: "account",
    frequency: "monthly",
    startDate: today(),
    mode: "confirm",
    reminderDays: "1",
    endKind: "none",
    endDate: "",
    maxOccurrences: "",
  };
}

function formFromRule(r: RecurringTransaction): FormState {
  return {
    kind: r.type !== "transfer" ? r.type : r.destination_liability_id ? "debt" : "transfer",
    name: r.name,
    amount: String(r.amount),
    currency: r.type === "income" && isTxCurrency(r.currency) ? r.currency : undefined,
    categoryId: r.category_id ?? undefined,
    link: r.liability_id ? "liability" : "account",
    accountId: r.account_id ?? undefined,
    liabilityId: r.liability_id ?? undefined,
    originId: r.origin_account_id ?? undefined,
    destAccountId: r.destination_account_id ?? undefined,
    destLiabilityId: r.destination_liability_id ?? undefined,
    frequency: r.frequency,
    startDate: r.start_date,
    mode: r.mode,
    reminderDays: String(r.reminder_days),
    endKind: r.end_date ? "date" : r.max_occurrences ? "count" : "none",
    endDate: r.end_date ?? "",
    maxOccurrences: r.max_occurrences ? String(r.max_occurrences) : "",
  };
}

const isTransfer = (k: Kind) => k === "transfer" || k === "debt";

type TxCurrency = (typeof TX_CURRENCIES)[number];
const isTxCurrency = (c: unknown): c is TxCurrency => TX_CURRENCIES.some((t) => t === c);

/** Lo que el API acepta en ambos: crear y editar. Devuelve un error legible o el payload. */
function commonFields(f: FormState): string | Omit<UpdateRecurringTransactionDto, "account_id" | "liability_id"> {
  const amount = parseFloat(f.amount);
  if (!f.name.trim()) return "El nombre es obligatorio";
  if (!amount || amount <= 0) return "El monto debe ser mayor a 0";
  if (f.endKind === "date" && !f.endDate) return "Escribe la fecha final";
  if (f.endKind === "count" && !(parseInt(f.maxOccurrences, 10) >= 1)) {
    return "El número de veces debe ser al menos 1";
  }
  return {
    name: f.name.trim(),
    amount,
    // El API convierte con TRM por ocurrencia; el cliente solo manda la moneda elegida (solo ingresos).
    ...(f.kind === "income" && f.currency ? { currency: f.currency } : {}),
    ...(f.categoryId && !isTransfer(f.kind) ? { category_id: f.categoryId } : {}),
    mode: f.mode,
    reminder_days: f.reminderDays === "" ? 1 : parseInt(f.reminderDays, 10),
    ...(f.endKind === "date" ? { end_date: f.endDate } : {}),
    ...(f.endKind === "count" ? { max_occurrences: parseInt(f.maxOccurrences, 10) } : {}),
  };
}

function toCreateDto(f: FormState): string | CreateRecurringTransactionDto {
  const common = commonFields(f);
  if (typeof common === "string") return common;
  const base = { ...common, frequency: f.frequency, start_date: f.startDate } as CreateRecurringTransactionDto;
  if (f.kind === "transfer") {
    if (!f.originId || !f.destAccountId) return "Elige la cuenta de origen y la de destino";
    return { ...base, type: "transfer", origin_account_id: f.originId, destination_account_id: f.destAccountId };
  }
  if (f.kind === "debt") {
    if (!f.originId || !f.destLiabilityId) return "Elige la cuenta de origen y el pasivo";
    return { ...base, type: "transfer", origin_account_id: f.originId, destination_liability_id: f.destLiabilityId };
  }
  if (f.link === "account" ? !f.accountId : !f.liabilityId) return "Elige una cuenta o un pasivo";
  return {
    ...base,
    type: f.kind,
    ...(f.link === "account" ? { account_id: f.accountId } : { liability_id: f.liabilityId }),
  };
}

/** Sin `type`, `frequency`, `start_date` ni destinos: el API responde 400 si llegan. */
function toUpdateDto(f: FormState, rule: RecurringTransaction): string | UpdateRecurringTransactionDto {
  const fields = commonFields(f);
  if (typeof fields === "string") return fields;
  // Excluyentes: el que no aplica va en `null`; ambos en `null` dejan la regla sin fin.
  const common = {
    ...fields,
    end_date: f.endKind === "date" ? f.endDate : null,
    max_occurrences: f.endKind === "count" ? parseInt(f.maxOccurrences, 10) : null,
  };
  if (isTransfer(f.kind)) {
    if (!f.originId) return "Elige la cuenta de origen";
    return { ...common, origin_account_id: f.originId };
  }
  // `null` quita la categoría; la subcategoría (que el formulario no maneja) no sobrevive a otra categoría.
  const categoryId = f.categoryId ?? null;
  const category = {
    category_id: categoryId,
    ...(categoryId !== rule.category_id ? { subcategory_id: null } : {}),
  };
  // Regla adoptada sin cuenta ni pasivo: puede seguir así si no se elige ninguno.
  if (!rule.account_id && !rule.liability_id && !f.accountId && !f.liabilityId) {
    return { ...common, ...category };
  }
  if (f.link === "account" ? !f.accountId : !f.liabilityId) return "Elige una cuenta o un pasivo";
  // `null` desliga el anterior al pasar de cuenta a pasivo o al revés.
  return f.link === "account"
    ? { ...common, ...category, account_id: f.accountId, liability_id: null }
    : { ...common, ...category, liability_id: f.liabilityId, account_id: null };
}

export default function RecurringScreen() {
  const userId = useAuthStore((s) => s.userId);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queryClient = useQueryClient();
  const { resolvedScheme } = useAppTheme();
  const colors = PALETTE[resolvedScheme];

  const [filter, setFilter] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cancelTarget, setCancelTarget] = useState<RecurringTransaction | null>(null);

  const enabled = !!userId && !isGuest;

  // Siempre la lista completa: el caché se reemplaza entero y una lista
  // filtrada borraría las demás. El filtro por estado es del cliente.
  const { data, isLoading, refetch, isUsingFallback, isNetworkBlocked } = useOfflineQuery(
    {
      queryKey: ["recurring", userId],
      queryFn: async () => {
        const rules = await recurringApi.listRecurring(userId as number);
        await localRepo.saveRecurringTransactions(userId as number, rules).catch(() => {});
        return rules;
      },
      enabled,
    },
    () => localRepo.getLocalRecurringTransactions(userId as number),
  );

  const { data: categories } = useOfflineQuery(
    { queryKey: ["categories"], queryFn: catalogApi.getCategories, enabled },
    () => localRepo.getLocalCategories(),
  );
  const { data: accounts } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId as number),
      enabled,
    },
    () => localRepo.getLocalBankAccounts(userId as number),
  );
  const { data: liabilities } = useOfflineQuery(
    {
      queryKey: ["financial-liabilities", userId],
      queryFn: () => bankingApi.getFinancialLiabilities(userId as number),
      enabled,
    },
    () => localRepo.getLocalFinancialLiabilities(userId as number),
  );

  // El API procesa al escribir: puede haber creado transacciones y movido saldos.
  function invalidateAfterWrite() {
    queryClient.invalidateQueries({ queryKey: ["recurring", userId] });
    queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
    queryClient.invalidateQueries({ queryKey: ["financial-liabilities", userId] });
  }

  const saveMutation = useMutation({
    mutationFn: (dto: CreateRecurringTransactionDto | UpdateRecurringTransactionDto) =>
      editing
        ? recurringApi.updateRecurring(userId as number, editing.id, dto)
        : recurringApi.createRecurring(userId as number, dto as CreateRecurringTransactionDto),
    onSuccess: () => {
      invalidateAfterWrite();
      toast.success(editing ? "Recurrente actualizado" : "Recurrente creado");
      setShowForm(false);
    },
    onError: (err: unknown) => toast.error("No se pudo guardar", apiErrorMessage(err, "Intenta de nuevo")),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => recurringApi.cancelRecurring(userId as number, id),
    onSuccess: () => {
      invalidateAfterWrite();
      toast.success("Recurrente cancelado");
      setCancelTarget(null);
    },
    onError: (err: unknown) => toast.error("No se pudo cancelar", apiErrorMessage(err, "Intenta de nuevo")),
  });

  if (isGuest) return <Redirect href="/(tabs)/transactions" />;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(rule: RecurringTransaction) {
    setEditing(rule);
    setForm(formFromRule(rule));
    setShowForm(true);
  }

  function handleSave() {
    // Guardia además del botón deshabilitado: la red puede caerse con el modal abierto.
    if (!isOnline) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    const dto = editing ? toUpdateDto(form, editing) : toCreateDto(form);
    if (typeof dto === "string") {
      toast.error("Revisa el formulario", dto);
      return;
    }
    saveMutation.mutate(dto);
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Moneda del producto elegido y la que rige el monto del ingreso (la propia, si la eligió).
  const productCurrency =
    form.link === "account"
      ? accounts?.find((a) => a.id === form.accountId)?.currency
      : liabilities?.find((l) => l.id === form.liabilityId)?.currency;
  const amountCurrency: TxCurrency =
    form.currency ?? (isTxCurrency(productCurrency) ? productCurrency : "COP");
  const showCurrency = form.kind === "income";
  const conversion = showCurrency ? fxNotice(amountCurrency, productCurrency) : null;

  const rules = (data ?? []).filter((r) => filter === "all" || r.status === filter);

  const accountChips = (selected: number | undefined, onSelect: (id: number) => void, exclude?: number) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      {(accounts ?? [])
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <Chip
            key={a.id}
            label={`${a.bank_name} ${a.masked_account_number}`}
            selected={selected === a.id}
            onPress={() => onSelect(a.id)}
            className="mr-2"
          />
        ))}
    </ScrollView>
  );

  const liabilityChips = (selected: number | undefined, onSelect: (id: number) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      {(liabilities ?? []).map((l) => (
        <Chip key={l.id} label={l.name} selected={selected === l.id} onPress={() => onSelect(l.id)} className="mr-2" />
      ))}
    </ScrollView>
  );

  const label = (text: string) => (
    <Text className="text-sm font-sans-medium text-foreground mb-1.5">{text}</Text>
  );

  return (
    <View className="flex-1 bg-background">
      {isUsingFallback && <StaleDataBanner onRetry={refetch} blocked={isNetworkBlocked} />}

      <View className="px-4 pt-4 pb-2 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver">
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-xl font-display text-foreground">Recurrentes</Text>
        <Button size="sm" onPress={openCreate} disabled={!isOnline} accessibilityLabel="Nuevo recurrente">
          <Plus size={16} color={colors.primaryForeground} />
          <Text className="text-sm font-sans-medium text-primary-foreground">Nuevo</Text>
        </Button>
      </View>

      {!isOnline && (
        <View className="mx-4 mb-2 flex-row items-center gap-2">
          <WifiOff size={14} color={colors.mutedForeground} />
          <Text className="flex-1 text-xs font-sans text-muted-foreground">{OFFLINE_MESSAGE}</Text>
        </View>
      )}

      <View className="flex-row flex-wrap px-4 gap-2 mb-3">
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            shape="pill"
            size="sm"
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </View>

      {isLoading ? (
        <View className="px-4 gap-3">
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        >
          {rules.length === 0 ? (
            <Card>
              <EmptyState
                icon={RefreshCw}
                title="Sin recurrentes"
                description="Registra pagos que se repiten, como el arriendo o la nómina."
              />
            </Card>
          ) : (
            rules.map((r) => (
              <Card key={r.id} className="gap-2">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-base font-sans-semibold text-foreground">{r.name}</Text>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </View>
                <Text className="text-lg font-num-semibold text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatCurrency(r.amount, r.currency === "USD" ? "USD" : "COP")}
                  <Text className="text-xs font-sans text-muted-foreground"> {r.currency}</Text>
                </Text>
                <Text className="text-xs font-sans text-muted-foreground">
                  {FREQUENCY_LABELS[r.frequency]}
                  {r.status === "active" ? ` · Próxima: ${r.next_due_date}` : ""}
                  {r.max_occurrences ? ` · ${r.occurrences_count} de ${r.max_occurrences} cuotas` : ""}
                </Text>
                {r.pending_validation_count > 0 && (
                  <Badge tone="warning" className="self-start">
                    {`${r.pending_validation_count} por validar`}
                  </Badge>
                )}
                {r.status === "active" && (
                  <View className="flex-row gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isOnline}
                      onPress={() => openEdit(r)}
                      accessibilityLabel={`Editar ${r.name}`}
                    >
                      <Pencil size={14} color={colors.foreground} />
                      <Text className="text-xs font-sans-medium text-foreground">Editar</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!isOnline}
                      onPress={() => setCancelTarget(r)}
                      accessibilityLabel={`Cancelar ${r.name}`}
                    >
                      <Trash size={14} color={colors.destructive} />
                      <Text className="text-xs font-sans-medium text-destructive">Cancelar</Text>
                    </Button>
                  </View>
                )}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[90%]">
            <Text className="text-lg font-display text-foreground mb-4">
              {editing ? "Editar recurrente" : "Nuevo recurrente"}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!editing && (
                <>
                  {label("Tipo")}
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                      <Chip key={k} label={KIND_LABELS[k]} size="sm" selected={form.kind === k} onPress={() => set("kind", k)} />
                    ))}
                  </View>
                </>
              )}

              <Input label="Nombre" value={form.name} onChangeText={(v) => set("name", v)} placeholder="Ej: Arriendo" />
              <CurrencyInput label="Monto" value={form.amount} onChangeValue={(v) => set("amount", v)}
                prefix={showCurrency && amountCurrency === "USD" ? "US$" : "$"}
                testID="recurring-amount-input"
              />
              {showCurrency && (
                <>
                  {label("Moneda")}
                  <View className="flex-row gap-2 mb-2">
                    {TX_CURRENCIES.map((cur) => (
                      <Chip
                        key={cur}
                        label={cur}
                        size="sm"
                        selected={amountCurrency === cur}
                        onPress={() => set("currency", cur)}
                      />
                    ))}
                  </View>
                  {conversion && (
                    <Text className="text-xs font-sans text-muted-foreground mb-4">
                      {`${conversion} ${FX_APPROX_NOTE}`}
                    </Text>
                  )}
                  {!conversion && <View className="mb-2" />}
                </>
              )}

              {isTransfer(form.kind) ? (
                <>
                  {label("Cuenta de origen")}
                  {/* En edición el destino no se muestra pero sigue fijo: el origen no puede ser él. */}
                  {accountChips(
                    form.originId,
                    (id) =>
                      setForm((f) => ({ ...f, originId: id, destAccountId: f.destAccountId === id ? undefined : f.destAccountId })),
                    form.kind === "transfer" ? form.destAccountId : undefined,
                  )}
                  {!editing && form.kind === "transfer" && (
                    <>
                      {label("Cuenta destino")}
                      {accountChips(form.destAccountId, (id) => set("destAccountId", id), form.originId)}
                    </>
                  )}
                  {!editing && form.kind === "debt" && (
                    <>
                      {label("Pasivo")}
                      {liabilityChips(form.destLiabilityId, (id) => set("destLiabilityId", id))}
                    </>
                  )}
                </>
              ) : (
                <>
                  {label("Desde")}
                  <View className="mb-3">
                    <SegmentedControl options={LINK_OPTIONS} value={form.link} onChange={(v) => set("link", v)} />
                  </View>
                  {form.link === "account"
                    ? accountChips(form.accountId, (id) => set("accountId", id))
                    : liabilityChips(form.liabilityId, (id) => set("liabilityId", id))}
                  {label("Categoría (opcional)")}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    {(categories ?? []).map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        selected={form.categoryId === c.id}
                        onPress={() => set("categoryId", form.categoryId === c.id ? undefined : c.id)}
                        className="mr-2"
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              {!editing && (
                <>
                  {label("Periodicidad")}
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map((fr) => (
                      <Chip
                        key={fr}
                        label={FREQUENCY_LABELS[fr]}
                        size="sm"
                        selected={form.frequency === fr}
                        onPress={() => set("frequency", fr)}
                      />
                    ))}
                  </View>
                  <Input
                    label="Primera fecha (AAAA-MM-DD)"
                    value={form.startDate}
                    onChangeText={(v) => set("startDate", v)}
                  />
                </>
              )}

              {label("Modo")}
              <View className="mb-4">
                <SegmentedControl options={MODE_OPTIONS} value={form.mode} onChange={(v) => set("mode", v)} />
              </View>
              <Input
                label="Días de anticipación del aviso"
                value={form.reminderDays}
                onChangeText={(v) => set("reminderDays", v.replace(/\D/g, ""))}
                keyboardType="number-pad"
              />

              {label("Termina")}
              <View className="mb-3">
                <SegmentedControl options={END_OPTIONS} value={form.endKind} onChange={(v) => set("endKind", v)} />
              </View>
              {form.endKind === "date" && (
                <Input label="Fecha final (AAAA-MM-DD)" value={form.endDate} onChangeText={(v) => set("endDate", v)} />
              )}
              {form.endKind === "count" && (
                <Input
                  label="Número de veces"
                  value={form.maxOccurrences}
                  onChangeText={(v) => set("maxOccurrences", v.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                />
              )}
            </ScrollView>

            {!isOnline && <Text className="text-xs font-sans text-muted-foreground mt-3">{OFFLINE_MESSAGE}</Text>}
            <View className="flex-row gap-3 mt-4">
              <Button variant="outline" className="flex-1" onPress={() => setShowForm(false)}>
                Cerrar
              </Button>
              <Button className="flex-1" onPress={handleSave} loading={saveMutation.isPending} disabled={!isOnline}>
                {editing ? "Guardar" : "Crear"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!cancelTarget}
        title="Cancelar recurrente"
        description={
          cancelTarget
            ? `"${cancelTarget.name}" no volverá a registrar movimientos. Las transacciones ya creadas se conservan.`
            : undefined
        }
        confirmLabel="Cancelar recurrente"
        cancelLabel="Volver"
        tone="destructive"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (!isOnline) {
            toast.error(OFFLINE_MESSAGE);
            return;
          }
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </View>
  );
}
