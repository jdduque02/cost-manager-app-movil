import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type { BankAccountResponse } from "@/types/banking.types";
import { router } from "expo-router";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import { RevealSection } from "@/components/ui/RevealSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ListRow } from "@/components/ui/ListRow";
import { StaleDataBanner } from "@/components/StaleDataBanner";
import { TrendAreaChart } from "@/components/charts/TrendAreaChart";
import { groupByMonth, txDate } from "@/utils/chart-data";
import { consolidate } from "@/utils/net-worth";
import { formatCurrency } from "@/utils/format";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  PiggyBank,
  ArrowLeftRight,
  ReceiptText,
  ChartColumn,
  Target,
  FileUp,
  type LucideIcon,
} from "@/components/ui/icons";

const TYPE_ICON: Record<string, LucideIcon> = {
  income: TrendingUp,
  expense: ShoppingBag,
  investment: PiggyBank,
  transfer: ArrowLeftRight,
};

const TYPE_TONE: Record<string, "success" | "destructive" | "primary" | "info"> = {
  income: "success",
  expense: "destructive",
  investment: "primary",
  transfer: "info",
};

const QUICK_ACTIONS: { label: string; href: "/(tabs)/transactions" | "/(tabs)/objectives" | "/reports" | "/statement-import"; icon: LucideIcon }[] = [
  { label: "Nueva Transacción", href: "/(tabs)/transactions", icon: ReceiptText },
  { label: "Ver Reportes", href: "/reports", icon: ChartColumn },
  { label: "Metas", href: "/(tabs)/objectives", icon: Target },
  { label: "Importar", href: "/statement-import", icon: FileUp },
];

export default function DashboardScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { resolvedScheme } = useAppTheme();

  const {
    data: txData,
    isLoading: loadingTx,
    refetch: refetchTx,
    isUsingFallback: txUsingFallback,
    isNetworkBlocked: txBlocked,
  } = useOfflineQuery(
    {
      // Sufijo "dashboard" para no compartir cache con el query key de la
      // pantalla de Transacciones (["transactions", userId]) — usaban la
      // misma key con params distintos, así que la primera en cargar le
      // "robaba" el resultado a la otra en vez de traer los suyos.
      queryKey: ["transactions", userId, "dashboard"],
      queryFn: () =>
        transactionsApi.getTransactions(userId as number, {
          date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 500,
        }),
      enabled: !!userId,
    },
    async () => {
      const data = await localRepo.getLocalTransactions(userId as number);
      return { data, total: data.length };
    },
  );

  const {
    data: accounts,
    isLoading: loadingAcc,
    refetch: refetchAcc,
    isUsingFallback: accUsingFallback,
    isNetworkBlocked: accBlocked,
  } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId as number),
      enabled: !!userId,
    },
    () => localRepo.getLocalBankAccounts(userId as number),
  );

  // Sin conexión, la última TRM guardada (R6.5); si nunca hubo, null y solo el desglose (R6.4).
  const { data: trm, isLoading: loadingTrm } = useOfflineQuery<bankingApi.Trm | null>(
    { queryKey: ["trm"], queryFn: bankingApi.getTrm, staleTime: 60 * 60 * 1000 },
    bankingApi.getCachedTrm,
  );

  const isLoading = loadingTx || loadingAcc || loadingTrm;
  const isUsingFallback = txUsingFallback || accUsingFallback;
  const transactions = useMemo(() => txData?.data ?? [], [txData]);
  // Ingresos, gastos y la gráfica del mes solo en COP: sumar USD como pesos los inflaba (R6.7).
  const copTransactions = useMemo(
    () => transactions.filter((t) => (t.currency || "COP") === "COP"),
    [transactions],
  );

  const now = useMemo(() => new Date(), []);
  const currentMonthTx = useMemo(
    () =>
      copTransactions.filter((t) => {
        const d = txDate(t);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    [copTransactions, now],
  );

  const { income, expenses } = useMemo(() => {
    const inc = currentMonthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const exp = currentMonthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income: inc, expenses: exp };
  }, [currentMonthTx]);

  // Saldo de las cuentas consolidado en COP (R6.1–R6.3).
  const balance = consolidate(
    (accounts ?? []).map((a): [string, number] => [a.currency, Number(a.display_balance)]),
    trm,
  );

  const monthlyPoints = useMemo(() => groupByMonth(copTransactions, 6), [copTransactions]);

  const recentTransactions = transactions.slice(0, 5);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <Skeleton width={160} height={28} className="mb-4" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={60} borderRadius={12} className="mb-3" />
        ))}
        <Skeleton height={200} borderRadius={12} className="mt-4" />
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
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => {
            refetchTx();
            refetchAcc();
          }}
        />
      }
      contentContainerClassName="pb-8"
    >
      {isUsingFallback && (
        <StaleDataBanner
          blocked={txBlocked || accBlocked}
          onRetry={() => {
            refetchTx();
            refetchAcc();
          }}
        />
      )}

      <View className="px-4 pt-4 gap-7">
        <RevealSection>
          <PageHeader title="Resumen financiero" subtitle="Este mes" />
        </RevealSection>

        <RevealSection delay={0}>
          <View className="flex-row flex-wrap gap-4">
            <View className="flex-1 min-w-[45%]">
              <StatCard
                icon={Wallet}
                label="Balance total"
                value={balance.total ?? balance.breakdown}
                tone="primary"
              />
              {balance.note && (
                <Text className="text-xs font-sans text-muted-foreground mt-1">{balance.note}</Text>
              )}
            </View>
            <View className="flex-1 min-w-[45%]">
              <StatCard icon={TrendingUp} label="Ingresos del mes" value={income} tone="success" />
            </View>
            <View className="flex-1 min-w-[45%]">
              <StatCard icon={TrendingDown} label="Gastos del mes" value={expenses} tone="destructive" />
            </View>
          </View>
        </RevealSection>

        <RevealSection delay={100}>
          <Card>
            <Text className="text-base font-display text-foreground mb-1">Ingresos vs. Gastos</Text>
            <Text className="text-sm font-sans text-muted-foreground mb-4">Últimos 6 meses</Text>
            {income === 0 && expenses === 0 ? (
              <EmptyState
                icon={ChartColumn}
                title="Sin movimientos este mes"
                description="La gráfica aparecerá cuando registres ingresos o gastos."
              />
            ) : (
              <TrendAreaChart points={monthlyPoints} />
            )}
          </Card>
        </RevealSection>

        <RevealSection delay={200}>
          <View>
            <Text className="text-base font-display text-foreground mb-3">Acciones rápidas</Text>
            <View className="flex-row flex-wrap gap-3">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon }, index) => (
                <AnimatedListItem key={label} index={index} className="w-[47%]">
                  <Pressable
                    className="bg-card border border-border rounded-xl p-4 items-center"
                    onPress={() => router.push(href)}
                  >
                    <Icon size={24} color={PALETTE[resolvedScheme].primary} strokeWidth={2} />
                    <Text className="text-xs font-sans-medium text-foreground text-center mt-2">
                      {label}
                    </Text>
                  </Pressable>
                </AnimatedListItem>
              ))}
            </View>
          </View>
        </RevealSection>

        <RevealSection delay={300}>
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-display text-foreground">Transacciones recientes</Text>
              <Pressable onPress={() => router.push("/(tabs)/transactions")}>
                <Text className="text-xs font-sans-medium text-primary">Ver todo</Text>
              </Pressable>
            </View>
            {recentTransactions.length === 0 ? (
              <Card>
                <EmptyState icon={ReceiptText} title="Sin transacciones" description="Aún no hay movimientos este mes." />
              </Card>
            ) : (
              <Card variant="flat" className="p-2">
                {recentTransactions.map((tx: TransactionRecordResponse) => (
                  <ListRow
                    key={tx.id}
                    icon={TYPE_ICON[tx.type] ?? ReceiptText}
                    tone={TYPE_TONE[tx.type] ?? "muted"}
                    title={tx.description ?? `Transacción #${tx.id}`}
                    meta={txDate(tx).toLocaleDateString("es-CO")}
                    // `amount` de ListRow formatea en COP; cada movimiento va en su moneda (R7.5).
                    right={
                      <Text
                        className={`text-sm font-num-semibold ${tx.type === "income" ? "text-success" : "text-foreground"}`}
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(tx.amount), tx.currency)}
                      </Text>
                    }
                  />
                ))}
              </Card>
            )}
          </View>
        </RevealSection>

        <RevealSection delay={400}>
          <View>
            <Text className="text-base font-display text-foreground mb-3">Cuentas bancarias</Text>
            {(accounts ?? []).length === 0 ? (
              <Card>
                <EmptyState icon={Wallet} title="Sin cuentas" description="Registra tu primera cuenta bancaria." />
              </Card>
            ) : (
              <Card variant="flat" className="p-2">
                {(accounts ?? []).map((acc: BankAccountResponse) => (
                  <ListRow
                    key={acc.id}
                    icon={Wallet}
                    tone="muted"
                    title={acc.bank_name}
                    meta={acc.masked_account_number}
                    amount={Number(acc.display_balance)}
                  />
                ))}
              </Card>
            )}
          </View>
        </RevealSection>
      </View>
    </ScrollView>
  );
}
