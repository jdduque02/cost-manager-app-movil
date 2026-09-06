import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useOfflineMutations } from "@/hooks/useOfflineMutations";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { Money } from "@/components/ui/Money";
import { Chip } from "@/components/ui/Chip";
import { StaleDataBanner } from "@/components/StaleDataBanner";
import { Wallet, CreditCard, Banknote, Plus } from "@/components/ui/icons";
import type {
  CreateBankAccountDto,
  AccountType,
  FinancialAssetResponse,
  FinancialLiabilityResponse,
} from "@/types/banking.types";
import { ACCOUNT_TYPE_LABELS, accountTypeLabel } from "@/types/banking.types";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

const ACCOUNT_TYPE_TONE: Record<AccountType, BadgeTone> = {
  corriente: "primary",
  ahorros: "success",
  cdt: "primary",
  inversion: "primary",
  ahorro_alto_rendimiento: "success",
  fna: "warning",
  aporte_pension_voluntaria: "warning",
  otro: "muted",
};

function SummarySkeleton() {
  return (
    <View className="bg-card p-5 border-b border-border">
      <Skeleton width={120} height={14} className="mb-2" />
      <Skeleton width={200} height={28} className="mb-4" />
      <View className="flex-row gap-3">
        <Skeleton width={100} height={36} borderRadius={8} />
        <Skeleton width={100} height={36} borderRadius={8} />
        <Skeleton width={100} height={36} borderRadius={8} />
      </View>
    </View>
  );
}

function ListSkeleton() {
  return (
    <View className="p-4 gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <Skeleton width={140} height={16} className="mb-2" />
          <Skeleton width={100} height={12} className="mb-3" />
          <Skeleton width={160} height={22} />
        </Card>
      ))}
    </View>
  );
}

export default function BankingScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { createBankAccount: createOffline, deleteBankAccount: deleteOffline } =
    useOfflineMutations();
  const { resolvedScheme } = useAppTheme();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateBankAccountDto>({
    bank_name: "",
    account_type: "ahorros",
    account_number: "",
    balance: 0,
    currency: "COP",
  });

  const {
    data: accounts,
    isLoading: loadingAccounts,
    refetch: refetchAccounts,
    isUsingFallback: accountsUsingFallback,
  } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalBankAccounts(userId as number),
  );

  const {
    data: assets,
    isLoading: loadingAssets,
    refetch: refetchAssets,
  } = useOfflineQuery(
    {
      queryKey: ["financial-assets", userId],
      queryFn: () => bankingApi.getFinancialAssets(userId as number),
      enabled: !!userId,
    },
    async () => [] as FinancialAssetResponse[],
  );

  const {
    data: liabilities,
    isLoading: loadingLiabilities,
    refetch: refetchLiabilities,
  } = useOfflineQuery(
    {
      queryKey: ["financial-liabilities", userId],
      queryFn: () => bankingApi.getFinancialLiabilities(userId as number),
      enabled: !!userId,
    },
    async () => [] as FinancialLiabilityResponse[],
  );

  const isLoading = loadingAccounts || loadingAssets || loadingLiabilities;

  const totalAccounts = (accounts ?? []).reduce(
    (s, a) => s + Number(a.display_balance),
    0,
  );
  const totalAssets = (assets ?? []).reduce((s, a) => s + Number(a.current_value), 0);
  const totalLiabilities = (liabilities ?? []).reduce(
    (s, l) => s + Number(l.current_balance),
    0,
  );
  const netWorth = totalAccounts + totalAssets - totalLiabilities;

  const refetchAll = useCallback(() => {
    refetchAccounts();
    refetchAssets();
    refetchLiabilities();
  }, [refetchAccounts, refetchAssets, refetchLiabilities]);

  const createMutation = useMutation({
    mutationFn: (dto: CreateBankAccountDto) => createOffline(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
      setShowCreateModal(false);
      setForm({
        bank_name: "",
        account_type: "ahorros",
        account_number: "",
        balance: 0,
        currency: "COP",
      });
    },
    onError: (err: unknown) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Error al crear cuenta");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteOffline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
    },
  });

  function handleCreateAccount() {
    if (!form.bank_name.trim() || !form.account_number.trim()) {
      Alert.alert("Campos requeridos", "Banco y número de cuenta son obligatorios");
      return;
    }
    createMutation.mutate(form);
  }

  function confirmDeleteAccount(id: number, name: string) {
    if (!isOnline) {
      Alert.alert("Sin conexión", "No puedes eliminar registros en modo offline");
      return;
    }
    Alert.alert("Eliminar cuenta", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }

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
          icon={Wallet}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para ver tus datos."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {accountsUsingFallback && <StaleDataBanner onRetry={refetchAll} />}
      <FlatList
        data={accounts ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetchAll} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="px-4 pt-4">
            <PageHeader title="Cuentas" subtitle="Tu patrimonio consolidado" />

            {/* Net Worth Summary */}
            <Card className="mt-4">
              <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-1">
                Patrimonio neto
              </Text>
              <Money value={netWorth} className="text-3xl text-foreground" />
              <View className="flex-row flex-wrap gap-2 mt-3">
                <Badge tone="success">{`${accounts?.length ?? 0} cuentas`}</Badge>
                <Badge tone="primary">{`${assets?.length ?? 0} activos`}</Badge>
                <Badge tone="destructive">{`${liabilities?.length ?? 0} deudas`}</Badge>
              </View>
            </Card>

            <View className="flex-row justify-between items-center mt-6 mb-3">
              <Text className="text-lg font-display text-foreground">Cuentas bancarias</Text>
              <Button size="sm" onPress={() => setShowCreateModal(true)}>
                <Plus size={16} color={PALETTE[resolvedScheme].primaryForeground} />
                <Text className="text-sm font-sans-medium text-primary-foreground">Nueva</Text>
              </Button>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index} className="mx-4 mb-2">
            <Card variant="flat" className="p-2" onPress={() => confirmDeleteAccount(item.id, item.bank_name)}>
              <ListRow
                icon={Wallet}
                tone={ACCOUNT_TYPE_TONE[item.account_type] ?? "muted"}
                title={item.bank_name}
                meta={`${item.masked_account_number} · ${accountTypeLabel(item.account_type)}`}
                right={
                  <View className="items-end">
                    <Money value={Number(item.display_balance)} className="text-sm text-foreground" />
                    {item.is_primary && (
                      <Badge tone="success" className="mt-1">
                        Principal
                      </Badge>
                    )}
                  </View>
                }
              />
            </Card>
          </AnimatedListItem>
        )}
        ListEmptyComponent={
          <View className="px-4">
            <Card>
              <EmptyState
                icon={Wallet}
                title="Sin cuentas bancarias"
                description="Registra tus cuentas para ver tu patrimonio"
                action={
                  <Button variant="outline" size="sm" onPress={() => setShowCreateModal(true)}>
                    Crear primera cuenta
                  </Button>
                }
              />
            </Card>
          </View>
        }
        ListFooterComponent={
          <View className="px-4">
            {(assets ?? []).length > 0 && (
              <>
                <View className="flex-row justify-between items-center mt-6 mb-3">
                  <Text className="text-lg font-display text-foreground">Activos financieros</Text>
                </View>
                <Card variant="flat" className="p-2">
                  {(assets ?? []).map((asset) => (
                    <ListRow
                      key={asset.id}
                      icon={CreditCard}
                      tone="success"
                      title={asset.name}
                      meta={asset.asset_type.replace(/_/g, " ")}
                      amount={Number(asset.current_value)}
                    />
                  ))}
                </Card>
              </>
            )}

            {(liabilities ?? []).length > 0 && (
              <>
                <View className="flex-row justify-between items-center mt-6 mb-3">
                  <Text className="text-lg font-display text-foreground">Deudas</Text>
                </View>
                <Card variant="flat" className="p-2">
                  {(liabilities ?? []).map((liability) => (
                    <ListRow
                      key={liability.id}
                      icon={Banknote}
                      tone="destructive"
                      title={liability.name}
                      meta={
                        liability.liability_type.replace(/_/g, " ") +
                        (liability.interest_rate != null
                          ? ` · ${liability.interest_rate}% interés`
                          : "")
                      }
                      amount={Number(liability.current_balance)}
                      amountClassName="text-destructive"
                    />
                  ))}
                </Card>
              </>
            )}

            {(accounts ?? []).length === 0 &&
              (assets ?? []).length === 0 &&
              (liabilities ?? []).length === 0 && (
                <Card className="mt-6">
                  <EmptyState
                    icon={Banknote}
                    title="Sin información financiera"
                    description="Agrega cuentas, activos o deudas para ver tu patrimonio"
                    action={
                      <Button variant="outline" size="sm" onPress={() => setShowCreateModal(true)}>
                        Agregar cuenta
                      </Button>
                    }
                  />
                </Card>
              )}
          </View>
        }
      />

      {/* Create Account Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-card rounded-t-3xl p-6 max-h-[85%]">
            <Text className="text-lg font-display text-foreground mb-5">Nueva cuenta bancaria</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Banco"
                value={form.bank_name}
                onChangeText={(v) => setForm((p) => ({ ...p, bank_name: v }))}
                placeholder="Bancolombia"
              />
              <Input
                label="Número de cuenta"
                value={form.account_number}
                onChangeText={(v) => setForm((p) => ({ ...p, account_number: v }))}
                placeholder="1234567890"
                keyboardType="numeric"
              />
              <CurrencyInput
                label="Saldo inicial"
                value={form.balance ? String(form.balance) : ""}
                onChangeValue={(raw) =>
                  setForm((p) => ({ ...p, balance: raw ? parseFloat(raw) : 0 }))
                }
                placeholder="0"
              />
              <Input
                label="Moneda"
                value={form.currency}
                onChangeText={(v) => setForm((p) => ({ ...p, currency: v }))}
                placeholder="COP"
              />

              <Text className="text-sm font-sans-medium text-foreground mb-2">Tipo de cuenta</Text>
              <View className="flex-row flex-wrap gap-2 mb-5">
                {ACCOUNT_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={ACCOUNT_TYPE_LABELS[t]}
                    selected={form.account_type === t}
                    onPress={() => setForm((p) => ({ ...p, account_type: t }))}
                  />
                ))}
              </View>

              <View className="flex-row gap-3 mt-2 mb-4">
                <Button variant="outline" className="flex-1" onPress={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" loading={createMutation.isPending} onPress={handleCreateAccount}>
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
